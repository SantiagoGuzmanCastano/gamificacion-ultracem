import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function setup(reducedMotion = false) {
  const tweens = [];
  let reverted = 0;
  const timeline = {
    fromTo(...args) { tweens.push(args); return this; },
    to(...args) { tweens.push(args); return this; },
  };
  const source = readFileSync(new URL('../src/advisor-entrance.js', import.meta.url), 'utf8')
    .replace("import { gsap } from 'gsap';", '').replaceAll('export function', 'function');
  const api = runInNewContext(`${source}\n({ playAdvisorEntrance, clearAdvisorEntrance, resetAdvisorEntrance });`, {
    window: { matchMedia: () => ({ matches: reducedMotion }) },
    gsap: { timeline: () => timeline, context: callback => { callback(); return { revert() { reverted++; } }; } },
  });
  const root = { querySelector: () => ({}), querySelectorAll: () => [] };
  return { api, root, tweens, reverted: () => reverted };
}

test('entrance plays once until a new login and cleanup reverts animations', () => {
  const { api, root, tweens, reverted } = setup();
  api.playAdvisorEntrance(root);
  const firstCount = tweens.length;
  assert.ok(firstCount > 0);
  api.clearAdvisorEntrance();
  assert.equal(reverted(), 1);
  api.playAdvisorEntrance(root);
  assert.equal(tweens.length, firstCount);
  api.resetAdvisorEntrance();
  api.playAdvisorEntrance(root);
  assert.equal(tweens.length, firstCount * 2);
});

test('reduced motion skips entrance without hiding content', () => {
  const { api, root, tweens } = setup(true);
  api.playAdvisorEntrance(root);
  assert.equal(tweens.length, 0);
  api.clearAdvisorEntrance();
});
