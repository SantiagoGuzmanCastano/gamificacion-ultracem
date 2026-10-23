import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function setup(reduced = false) {
  const layers = [], positions = [];
  let killed = 0;
  const createElement = () => ({ style: {}, children: [], append(...nodes) { this.children.push(...nodes); }, setAttribute() {}, remove() { this.removed = true; } });
  const source = readFileSync(new URL('../src/advisor-effects.js', import.meta.url), 'utf8')
    .replace("import { gsap } from 'gsap';", '').replaceAll('export function', 'function');
  const api = runInNewContext(`${source}\n({ celebrateTask, celebrateSale, clearAdvisorEffects });`, {
    window: { innerWidth: 1280, innerHeight: 800, matchMedia: () => ({ matches: reduced }) },
    document: { createElement, body: { append(layer) { layers.push(layer); } } },
    gsap: { set: (node, position) => positions.push(position), timeline: () => ({ to() { return this; }, kill() { killed++; } }) },
  });
  return { api, layers, positions, killed: () => killed };
}

test('task celebration bursts from the button and sale celebration covers the whole screen', () => {
  const { api, layers, positions, killed } = setup();
  api.celebrateTask({ x: 120, y: 240 });
  assert.equal(layers[0].children.length, 26);
  assert.equal(positions[0].x, 120);
  assert.equal(positions[0].y, 240);
  api.celebrateSale();
  assert.equal(layers[0].removed, true);
  // 40 desde Topitín, 32 por cada cañón de esquina y 116 de lluvia a 1280 px.
  assert.equal(layers[1].children.length, 40 + 32 * 2 + 116);
  const sale = positions.slice(26);
  // Sin mascota en pantalla, el estallido de Topitín sale de arriba al centro.
  assert.equal(sale[0].x, 640);
  assert.equal(sale[0].y, 240);
  // Los cañones salen de las esquinas de abajo.
  assert.deepEqual([sale[40].x, sale[40].y], [0, 800]);
  assert.deepEqual([sale[72].x, sale[72].y], [1280, 800]);
  // La lluvia entra por arriba y se reparte por todo el ancho.
  const rain = sale.slice(104);
  assert.ok(rain.every(position => position.y < 0));
  assert.ok(Math.min(...rain.map(position => position.x)) < 40);
  assert.ok(Math.max(...rain.map(position => position.x)) > 1240);
  api.clearAdvisorEffects();
  assert.equal(layers[1].removed, true);
  assert.ok(killed() >= 2);
});

test('reduced motion creates no confetti particles', () => {
  const { api, layers } = setup(true);
  api.celebrateTask({ x: 120, y: 240 });
  api.celebrateSale();
  assert.equal(layers.length, 0);
});
