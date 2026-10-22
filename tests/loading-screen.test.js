import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function setup(reducedMotion = false) {
  const tweens = [];
  let reverted = 0;
  const root = { className: '', innerHTML: '', attrs: {}, setAttribute(name, value) { this.attrs[name] = value; }, removeAttribute(name) { delete this.attrs[name]; } };
  const source = readFileSync(new URL('../src/loading-screen.js', import.meta.url), 'utf8')
    .replace(/^import .*;$/gm, '').replaceAll('export function', 'function');
  const timeline = { fromTo(...args) { tweens.push(args); return this; }, to(...args) { tweens.push(args); return this; }, set() { return this; } };
  const api = runInNewContext(`${source}\n({ showLoadingScreen, clearLoadingScreen });`, {
    window: { matchMedia: () => ({ matches: reducedMotion }) },
    gsap: { context: callback => { callback(); return { revert() { reverted++; } }; }, fromTo: (...args) => tweens.push(args), timeline: () => timeline },
  });
  return { api, root, tweens, reverted: () => reverted };
}

test('loader shows official logo and cement illustration without fake percentages', () => {
  const { api, root, tweens, reverted } = setup();
  api.showLoadingScreen(root);
  assert.equal(root.className, 'loading-shell');
  assert.equal(root.attrs['aria-busy'], 'true');
  assert.match(root.innerHTML, /\/ultracem-logo\.png/);
  assert.match(root.innerHTML, /Preparando tu espacio/);
  assert.match(root.innerHTML, /role="status"/);
  assert.match(root.innerHTML, /cement-fill/);
  assert.doesNotMatch(root.innerHTML, /aria-valuenow|\d+%/);
  assert.ok(tweens.length > 0);
  api.clearLoadingScreen(root);
  assert.equal(root.attrs['aria-busy'], undefined);
  assert.equal(reverted(), 1);
});

test('reduced motion keeps logo and status visible without animation', () => {
  const { api, root, tweens } = setup(true);
  api.showLoadingScreen(root);
  assert.match(root.innerHTML, /Preparando tu espacio/);
  assert.equal(tweens.length, 0);
  api.clearLoadingScreen(root);
});

test('restarting the loader cleans up the previous animation', () => {
  const { api, root, reverted } = setup();
  api.showLoadingScreen(root);
  api.showLoadingScreen(root);
  assert.equal(reverted(), 1);
  api.clearLoadingScreen(root);
  assert.equal(reverted(), 2);
  api.clearLoadingScreen(root);
  assert.equal(reverted(), 2);
});

test('admin, advisor, logged-out and failed boots all leave the loader', async () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const bootSource = source.slice(source.indexOf('async function boot('), source.indexOf('function stopHalloweenSync('));
  for (const role of ['admin', 'advisor', null, 'failure']) {
    const events = [];
    const root = {};
    const boot = runInNewContext(`let user, profile = null, halloweenTimer, advisorView = 'dashboard'; ${bootSource}; boot;`, {
      root, db: { auth: { getUser: async () => ({ data: { user: role ? { id: 'test' } : null } }) } },
      showLoadingScreen: () => events.push('loading'), shell: () => events.push('shell'),
      loadData: async () => { if (role === 'failure') throw new Error('offline'); events.push('data'); },
      refreshHalloween: async () => events.push('settings'), render: () => events.push('render'),
      resetAdvisorEntrance() {}, stopHalloweenSync() {}, notice() {},
      window: { setInterval: () => 1 }, document: { querySelector: () => ({ replaceChildren() { events.push('retry'); } }) },
      el() {}, button() {},
    });
    await boot();
    assert.ok(events.includes('loading'));
    assert.ok(events.includes(role === 'failure' ? 'retry' : 'render'));
  }
});
