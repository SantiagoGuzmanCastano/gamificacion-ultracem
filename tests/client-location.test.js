import test from 'node:test';
import assert from 'node:assert/strict';
import { COLOMBIA_DEPARTMENTS, citiesForDepartment, normalizeClientLocation } from '../src/client-location.js';

test('normalizes a valid Colombian client location', () => {
  assert.deepEqual(normalizeClientLocation('  Barranquilla  ', 'Atlántico'), {
    city: 'Barranquilla',
    department: 'Atlántico',
  });
});

test('rejects incomplete or unknown client locations', () => {
  assert.equal(normalizeClientLocation('', 'Atlántico'), null);
  assert.equal(normalizeClientLocation('Bogotá', 'Departamento inventado'), null);
});

test('offers the supplied capital for each department', () => {
  assert.equal(COLOMBIA_DEPARTMENTS.length, 33);
  assert.deepEqual(citiesForDepartment('Atlántico'), ['Barranquilla']);
  assert.deepEqual(citiesForDepartment('Antioquia'), ['Medellín']);
  assert.deepEqual(citiesForDepartment('Cundinamarca'), ['Bogotá']);
  assert.deepEqual(citiesForDepartment('Bogotá D.C.'), ['Bogotá D.C.']);
  assert.deepEqual(citiesForDepartment('Departamento inventado'), []);
});

test('rejects a city that does not belong to the selected department', () => {
  assert.equal(normalizeClientLocation('Medellín', 'Atlántico'), null);
  assert.equal(normalizeClientLocation('Ciudad inventada', 'Antioquia'), null);
  assert.deepEqual(normalizeClientLocation('  Medellín  ', 'Antioquia'), {
    city: 'Medellín',
    department: 'Antioquia',
  });
});
