import test from 'node:test';
import assert from 'node:assert/strict';
import { getClientHistoryStatus, isCurrentClient } from '../src/advisor-metrics.js';

const client = (completed) => ({ id: 'client-1', tasks: Array.from({ length: 4 }, (_, index) => ({ completed: index < completed })) });

test('classifies advisor clients for actions and history', () => {
  assert.deepEqual(getClientHistoryStatus(client(2), []), { label: 'Pendiente', percentage: 50, current: true });
  assert.deepEqual(getClientHistoryStatus(client(4), []), { label: 'Listo para venta', percentage: 100, current: true });
  assert.deepEqual(getClientHistoryStatus(client(4), [{ client_id: 'client-1', confirmed: true }]), { label: 'Venta confirmada', percentage: 100, current: false });
  assert.equal(isCurrentClient(client(2), []), true);
  assert.equal(isCurrentClient(client(4), [{ client_id: 'client-1', confirmed: true }]), false);
});
