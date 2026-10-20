import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdvisor, createCustomer } from '../src/game.js';
import { STORAGE_KEY, loadState, saveState, resetState } from '../src/storage.js';

function storage() {
  const entries = new Map();
  return {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: key => entries.delete(key),
  };
}

test('guarda y recupera asesores, clientes y tareas', () => {
  const store = storage();
  const advisor = createAdvisor('Ana');
  const customer = createCustomer('Ferretería Norte', 'Ferretería', advisor.id);
  customer.tasks[0].completed = true;
  const state = { version: 2, advisors: [advisor], customers: [customer] };
  assert.equal(saveState(state, store), '');
  assert.deepEqual(loadState(store), { state, message: '' });
});

test('migra datos previos conservando las tareas de cada participante', () => {
  const store = storage();
  const old = createCustomer('Ana', 'Ferretería', 'unused');
  old.tasks[0].completed = true;
  store.setItem(STORAGE_KEY, JSON.stringify({ version: 1, clients: [{ id: old.id, name: old.name, tasks: old.tasks }] }));
  const { state, message } = loadState(store);
  assert.equal(state.version, 2);
  assert.deepEqual(state.advisors, [{ id: old.id, name: old.name }]);
  assert.equal(state.customers[0].advisorId, old.id);
  assert.deepEqual(state.customers[0].tasks, old.tasks);
  assert.match(message, /datos anteriores/i);
  assert.equal(JSON.parse(store.getItem(STORAGE_KEY)).version, 2);
});

test('rechaza referencias huérfanas y datos corruptos sin romper la demo', () => {
  const store = storage();
  const advisor = createAdvisor('Ana');
  const customer = createCustomer('Norte', 'Ferretería', advisor.id);
  for (const raw of ['{', JSON.stringify({ version: 2, advisors: [], customers: [customer] })]) {
    store.setItem(STORAGE_KEY, raw);
    const result = loadState(store);
    assert.deepEqual(result.state.customers, []);
    assert.match(result.message, /No se pudieron leer/i);
  }
});

test('bloqueo de almacenamiento y reinicio selectivo', () => {
  const blocked = {
    getItem() { throw Error('bloqueado'); },
    setItem() { throw Error('bloqueado'); },
    removeItem() { throw Error('bloqueado'); },
  };
  assert.match(saveState({ version: 2, advisors: [], customers: [] }, blocked), /no se conservarán/i);
  assert.deepEqual(loadState(blocked).state.advisors, []);
  const store = storage();
  store.setItem('otra-app', 'conservar');
  store.setItem(STORAGE_KEY, '{}');
  assert.equal(resetState(store), '');
  assert.equal(store.getItem(STORAGE_KEY), null);
  assert.equal(store.getItem('otra-app'), 'conservar');
});
