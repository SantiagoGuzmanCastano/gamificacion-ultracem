import test from 'node:test';
import assert from 'node:assert/strict';
import { attachRankingAvatars } from '../src/ranking-avatars.js';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const rows = [{ advisor_id: 'a', full_name: 'Ana', position: 1, confirmed_sales: 2 }, { advisor_id: 'b', full_name: 'Beto', position: 2, confirmed_sales: 1 }];
const own = { user_id: 'a', avatar_url: '/own.png' };

function client({ rpcError = null, signingError = null, throws = false } = {}) {
  const calls = [];
  return { calls, async rpc(name) {
    calls.push(name);
    if (throws) throw new Error('offline');
    return { error: rpcError, data: [{ advisor_id: 'b', avatar_path: 'b/photo.png' }] };
  }, storage: { from(bucket) { calls.push(bucket); return { async createSignedUrls(paths, expiry) {
    calls.push({ paths, expiry });
    return { error: signingError, data: [{ path: 'b/photo.png', signedUrl: '/signed-b.png' }] };
  } }; } } };
}

test('ranking photos are signed in a batch without changing order or metrics', async () => {
  const db = client();
  const result = await attachRankingAvatars(db, rows, own);
  assert.equal(result[0].avatar_url, '/own.png');
  assert.equal(result[1].avatar_url, '/signed-b.png');
  assert.equal(result[1].confirmed_sales, 1);
  assert.deepEqual(result.map(row => row.advisor_id), ['a', 'b']);
  assert.deepEqual(db.calls.at(-1), { paths: ['b/photo.png'], expiry: 3600 });
  assert.equal(rows[0].avatar_url, undefined);
});

test('missing migration and photo failures preserve ranking and own avatar', async () => {
  for (const options of [{ rpcError: { message: 'function missing' } }, { signingError: { message: 'denied' } }, { throws: true }]) {
    const result = await attachRankingAvatars(client(options), rows, own);
    assert.equal(result.length, 2);
    assert.equal(result[0].avatar_url, '/own.png');
    assert.equal(result[1].avatar_url, '');
    assert.equal(result[1].confirmed_sales, 1);
  }
});

test('admin without their own photo still receives advisor avatars', async () => {
  const result = await attachRankingAvatars(client(), rows, { user_id: 'admin' });
  assert.equal(result[0].avatar_url, '');
  assert.equal(result[1].avatar_url, '/signed-b.png');
});

test('empty ranking does not request photo data', async () => {
  const db = client();
  assert.deepEqual(await attachRankingAvatars(db, [], own), []);
  assert.deepEqual(db.calls, []);
});

test('background renewal keeps each ranking photo linked to its own advisor', async () => {
  for (const ownPath of ['a/own.png', null]) {
    let tick;
    const images = [
      { tagName: 'IMG', dataset: {}, classList: { contains: () => false } },
      ...['a', 'b'].map(id => ({ tagName: 'IMG', dataset: { advisorId: id }, classList: { contains: () => true }, replaceWith(node) { this.replacement = node; } })),
    ];
    const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    const fn = source.slice(source.indexOf('function scheduleProfilePhotoUrlRefresh('), source.indexOf('async function markProfilePhotoPrompted('));
    const api = runInNewContext(`let profilePhotoUrlTimer; const user={id:'a'}; const profile={user_id:'a',avatar_path:${JSON.stringify(ownPath)},avatar_url:'/own.png'}; let ranking=[{advisor_id:'a',avatar_url:'/own.png'},{advisor_id:'b',avatar_url:'/b.png'}]; ${fn}; ({scheduleProfilePhotoUrlRefresh});`, {
      window: { clearInterval() {}, setInterval: callback => { tick = callback; return 1; } },
      document: { querySelectorAll: () => images },
      db: { storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: '/renewed-own.png' } }) }) } },
      attachRankingAvatars: async () => [{ advisor_id: 'a', avatar_url: '/own.png' }, { advisor_id: 'b', avatar_url: '/renewed-b.png' }],
      createProfileAvatar: row => ({ src: row.avatar_url }),
    });
    api.scheduleProfilePhotoUrlRefresh();
    await tick();
    assert.equal(images[2].replacement.src, '/renewed-b.png');
    assert.equal(images[1].replacement.src, ownPath ? '/renewed-own.png' : '/own.png');
  }
});
