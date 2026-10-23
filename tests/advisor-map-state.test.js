import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getDepartmentClientStates, groupCityClients } from '../src/advisor-map.js';

const capitals = JSON.parse(readFileSync(new URL('../public/data/colombia-capitals.json', import.meta.url)));

test('only departments with loaded clients are active', () => {
  const states = getDepartmentClientStates([
    { name: 'Ferretería Norte', department: 'Atlántico', city: 'Barranquilla' },
    { name: 'Constructora Costa', department: 'Atlántico', city: 'Barranquilla' },
    { name: 'Cliente antiguo', department: null, city: null },
  ], capitals);
  assert.equal(states.get('08').clients.length, 2);
  assert.equal(states.get('05').clients.length, 0);
  assert.equal(states.size, 33);
});

test('empty portfolio leaves every department blocked', () => {
  const states = getDepartmentClientStates([], capitals);
  assert.ok([...states.values()].every(state => state.clients.length === 0));
});

test('one city marker groups multiple clients in the same department', () => {
  const clients = [
    { name: 'Ferretería Norte', type: 'Ferretería', department: 'Atlántico', city: 'Barranquilla' },
    { name: 'Constructora Costa', type: 'Constructora', department: 'Atlántico', city: 'Barranquilla' },
    { name: 'Ferretería Centro', type: 'Ferretería', department: 'Antioquia', city: 'Medellín' },
  ];
  const { groups, warnings } = groupCityClients(clients, capitals);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].clients.length, 2);
  assert.equal(groups[0].city, 'Barranquilla');
  assert.equal(groups[0].department, 'Atlántico');
  assert.deepEqual(groups[0].coordinates, [-74.815546, 10.977961]);
  assert.equal(warnings.length, 0);
});

test('missing or invalid city has no marker but keeps its department active', () => {
  const clients = [
    { name: 'Sin ciudad', department: 'Atlántico', city: null },
    { name: 'Ciudad inválida', department: 'Atlántico', city: 'No existe' },
  ];
  const { groups, warnings } = groupCityClients(clients, capitals);
  assert.equal(groups.length, 0);
  assert.equal(warnings.length, 2);
  assert.equal(getDepartmentClientStates(clients, capitals).get('08').clients.length, 2);
});
