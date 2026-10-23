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
    gsap: { set: (node, position) => positions.push(position), timeline: () => {
      let total = 0;
      const add = vars => { total += vars?.duration || 0; flashDurations.push(total); };
      return { to(node, vars) { add(vars); return this; }, fromTo(node, from, vars) { add(vars); return this; }, kill() { killed++; } };
    } },
  });
  return { api, layers, positions, killed: () => killed };
}
const flashDurations = [];

// §14 de CLAUDE.md: sin confeti saturado. Tarea = ráfaga corta; venta = destello dorado de menos de 1,5 s.
test('task celebration is a small burst and sale celebration is a short golden flash', () => {
  const { api, layers, positions, killed } = setup();
  api.celebrateTask({ x: 120, y: 240 });
  assert.equal(layers[0].children.length, 12);
  assert.equal(positions[0].x, 120);
  assert.equal(positions[0].y, 240);
  api.celebrateSale();
  assert.equal(layers[0].removed, true);
  assert.match(layers[1].className, /advisor-sale-flash/);
  assert.equal(layers[1].children.length, 0);
  assert.ok(flashDurations.at(-1) < 1.5);
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
