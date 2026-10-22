import test from 'node:test';
import assert from 'node:assert/strict';
import { getRankingSlots, getPortfolioProgress, getMonthlyGoal, getClientSaleState } from '../src/advisor-metrics.js';

test('ranking preserves real advisors and pads only missing slots', () => {
  for (const count of [0, 1, 2, 3, 5]) {
    const rows = Array.from({ length: count }, (_, index) => ({ advisor_id: String(index), position: index + 1, full_name: `Advisor ${index}` }));
    const slots = getRankingSlots(rows);
    assert.equal(slots.length, Math.max(3, count));
    assert.deepEqual(slots.slice(0, count), rows);
    for (const slot of slots.slice(count)) {
      assert.equal(slot.placeholder, true);
      assert.equal(slot.full_name, 'Falta un asesor');
      assert.equal(slot.confirmed_sales, undefined);
    }
    assert.equal(rows.length, count);
  }
});

const tasks = completed => Array.from({ length: 4 }, (_, i) => ({ completed: i < completed }));

test('portfolio progress counts tasks and only unconfirmed clients ready for sale', () => {
  const clients = [{ id: 'a', tasks: tasks(4) }, { id: 'b', tasks: tasks(4) }, { id: 'c', tasks: tasks(2) }];
  const result = getPortfolioProgress(clients, [{ client_id: 'b', confirmed: true }]);
  assert.deepEqual(result, { completed: 10, total: 12, percentage: 83, readyClients: 1 });
  assert.deepEqual(getPortfolioProgress([], []), { completed: 0, total: 0, percentage: 0, readyClients: 0 });
  assert.equal(getPortfolioProgress([{ id: 'x', tasks: [] }], []).readyClients, 0);
});

test('monthly goal displays the real percentage while capping the graphic', () => {
  assert.deepEqual(getMonthlyGoal(42), { percentage: 42, fill: 42 });
  assert.deepEqual(getMonthlyGoal(220), { percentage: 220, fill: 100 });
  assert.deepEqual(getMonthlyGoal(0), { percentage: 0, fill: 0 });
});

test('client sale state distinguishes pending, ready and confirmed', () => {
  assert.equal(getClientSaleState({ id: 'a', tasks: tasks(3) }, []), 'pending');
  assert.equal(getClientSaleState({ id: 'a', tasks: tasks(4) }, []), 'ready');
  assert.equal(getClientSaleState({ id: 'a', tasks: tasks(4) }, [{ client_id: 'a', confirmed: true }]), 'confirmed');
  assert.equal(getClientSaleState({ id: 'a', tasks: [] }, [{ client_id: 'a', confirmed: true }]), 'confirmed');
});
