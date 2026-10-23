import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('function applyResource('), app.indexOf('async function boot(')).replace(/import\.meta\.env\.DEV/g, 'false');

function setup(loaders = {}) {
  const events = [];
  const context = vm.createContext({
    user: { id: 'me' }, profile: { user_id: 'me', points: 10 }, clients: [], sales: [], ranking: [], notifications: [], selectedId: null,
    notificationCenter: null, resourceLoaders: loaders, performance, window: { setTimeout, clearTimeout },
    render: () => events.push('render'), notice: (text, error) => events.push(error ? `error:${text}` : `notice:${text}`), playQueuedEffect: () => {},
  });
  vm.runInContext(source, context);
  return { context, events };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('an optimistic write renders before Supabase answers and reloads only the named resource', async () => {
  const requested = [];
  const { context, events } = setup({ sales: async () => { requested.push('sales'); return [{ id: 's1', commission_status: 'pending' }]; } });
  context.sales = [{ id: 's1', commission_status: 'available' }];
  let finish;
  const pending = context.optimisticWrite({
    label: 'test',
    apply: () => { context.sales = [{ id: 's1', commission_status: 'pending' }]; },
    revert: () => { context.sales = [{ id: 's1', commission_status: 'available' }]; },
    write: () => new Promise(resolve => { finish = resolve; }),
    reload: ['sales'],
  });
  assert.deepEqual(events, ['render']);
  assert.equal(context.sales[0].commission_status, 'pending');
  finish({ data: 1 });
  assert.deepEqual(await pending, { data: 1 });
  await tick();
  assert.deepEqual(requested, ['sales']);
  assert.deepEqual(events, ['render'], 'matching server data does not re-render');
});

test('a failed write undoes the change and shows the error', async () => {
  const { context, events } = setup({ sales: async () => [{ id: 's1', commission_status: 'available' }] });
  context.sales = [{ id: 's1', commission_status: 'available' }];
  const result = await context.optimisticWrite({
    label: 'test',
    apply: () => { context.sales = [{ id: 's1', commission_status: 'pending' }]; },
    revert: () => { context.sales = [{ id: 's1', commission_status: 'available' }]; },
    write: async () => ({ error: { message: 'Commission is not available' } }),
    reload: ['sales'],
  });
  assert.equal(result, null);
  assert.equal(context.sales[0].commission_status, 'available');
  assert.deepEqual(events, ['render', 'render', 'error:Commission is not available']);
});

test('background reloads wait for writes still in flight so they cannot erase newer optimistic changes', async () => {
  const requested = [];
  const { context } = setup({ clients: async () => { requested.push('clients'); return []; }, ranking: async () => { requested.push('ranking'); return []; } });
  let finishSecond;
  const first = context.optimisticWrite({ label: 'a', apply() {}, revert() {}, write: async () => ({ data: true }), reload: ['clients'] });
  const second = context.optimisticWrite({ label: 'b', apply() {}, revert() {}, write: () => new Promise(resolve => { finishSecond = resolve; }), reload: ['ranking'] });
  await first;
  await tick();
  assert.deepEqual(requested, []);
  finishSecond({ data: true });
  await second;
  await tick();
  assert.deepEqual(requested.sort(), ['clients', 'ranking']);
});

test('partial ranking reloads keep photos already signed', () => {
  const { context } = setup();
  context.ranking = [{ advisor_id: 'a', position: 2, avatar_url: '/a.png' }];
  context.applyResource('ranking', [{ advisor_id: 'a', position: 1 }, { advisor_id: 'b', position: 2 }]);
  assert.deepEqual(context.ranking.map(row => [row.advisor_id, row.position, row.avatar_url]), [['a', 1, '/a.png'], ['b', 2, '']]);
});
