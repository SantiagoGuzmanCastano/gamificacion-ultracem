import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../src/game.js';
import { STORAGE_KEY, loadState, saveState, resetState } from '../src/storage.js';

function memoryStorage() {
  const entries = new Map();
  return {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: key => entries.delete(key),
  };
}

test('sin datos inicia vacío con una indicación legible', () => {
  const result = loadState(memoryStorage());
  assert.deepEqual(result.state, { version: 1, clients: [] });
  assert.match(result.message, /datos guardados/i);
});

test('guardar y leer conserva IDs, contenido y finalizaciones sin sortear', () => {
  const storage = memoryStorage();
  const state = { version: 1, clients: [createClient('Ana'), createClient('Luis')] };
  state.clients[0].tasks[0].completed = true;
  assert.equal(saveState(state, storage), '');
  assert.deepEqual(loadState(storage), { state, message: '' });
});

test('rechaza JSON corrupto, versiones, campos e identificadores inválidos', () => {
  const storage = memoryStorage();
  const valid = { version: 1, clients: [createClient('Ana'), createClient('Luis')] };
  const variants = [null, [], {}, { version: 2, clients: [] }];
  for (const mutate of [
    state => { state.clients[0].name = '   '; },
    state => { state.clients[0].tasks[0].completed = 'true'; },
    state => { state.clients[0].tasks[0].reason = null; },
    state => { state.clients[0].tasks.pop(); },
    state => { state.clients[1].id = state.clients[0].id; },
    state => { state.clients[1].tasks[0].id = state.clients[0].tasks[0].id; },
    state => { state.clients[0].tasks[1].templateId = state.clients[0].tasks[0].templateId; },
  ]) {
    const state = structuredClone(valid);
    mutate(state);
    variants.push(state);
  }
  for (const raw of ['{corrupto', ...variants.map(value => JSON.stringify(value))]) {
    storage.setItem(STORAGE_KEY, raw);
    const result = loadState(storage);
    assert.deepEqual(result.state.clients, []);
    assert.match(result.message, /no se pudieron leer/i);
  }
});

test('almacenamiento bloqueado informa sin lanzar errores', () => {
  const blocked = {
    getItem() { throw new Error('bloqueado'); },
    setItem() { throw new Error('cuota'); },
    removeItem() { throw new Error('bloqueado'); },
  };
  assert.deepEqual(loadState(blocked).state.clients, []);
  assert.match(saveState({ version: 1, clients: [] }, blocked), /no se conservarán/i);
  assert.match(resetState(blocked), /no se pudieron borrar/i);
});

test('reiniciar elimina solamente la clave de esta aplicación', () => {
  const storage = memoryStorage();
  storage.setItem('otra-app', 'conservar');
  saveState({ version: 1, clients: [createClient('Ana')] }, storage);
  assert.equal(resetState(storage), '');
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.getItem('otra-app'), 'conservar');
});
