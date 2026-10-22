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

test('task celebration bursts from the button and sale celebration rains across the viewport', () => {
  const { api, layers, positions, killed } = setup();
  api.celebrateTask({ x: 120, y: 240 });
  assert.equal(layers[0].children.length, 36);
  assert.equal(positions[0].x, 120);
  assert.equal(positions[0].y, 240);
  api.celebrateSale();
  assert.equal(layers[0].removed, true);
  assert.equal(layers[1].children.length, 96);
  assert.equal(positions[36].y, -20);
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
