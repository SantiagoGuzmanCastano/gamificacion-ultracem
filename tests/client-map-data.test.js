import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLOMBIA_CAPITALS } from '../src/client-location.js';

const departments = JSON.parse(readFileSync(new URL('../public/data/colombia-departments.geojson', import.meta.url)));
const capitals = JSON.parse(readFileSync(new URL('../public/data/colombia-capitals.json', import.meta.url)));

test('local geography covers all 33 departments with a capital coordinate', () => {
  const codes = departments.features.map(feature => feature.properties.divipola_dep);
  assert.equal(departments.type, 'FeatureCollection');
  assert.equal(codes.length, 33);
  assert.equal(new Set(codes).size, 33);
  assert.equal(capitals.length, 33);
  for (const feature of departments.features) {
    assert.match(feature.properties.dpto_nombre, /\S/);
    assert.ok(['Polygon', 'MultiPolygon'].includes(feature.geometry.type));
    const capital = capitals.find(item => item.departmentCode === feature.properties.divipola_dep);
    assert.ok(capital, `Missing capital for ${feature.properties.dpto_nombre}`);
    assert.equal(capital.name, COLOMBIA_CAPITALS[capital.department]);
    assert.ok(capital.longitude >= -82 && capital.longitude <= -66);
    assert.ok(capital.latitude >= -5 && capital.latitude <= 14);
  }
});

test('Barranquilla and Medellín match their DIVIPOLA departments', () => {
  assert.deepEqual(capitals.filter(item => ['05', '08'].includes(item.departmentCode)).map(item => [
    item.departmentCode, item.code, item.name,
  ]), [
    ['05', '05001', 'Medellín'],
    ['08', '08001', 'Barranquilla'],
  ]);
});
