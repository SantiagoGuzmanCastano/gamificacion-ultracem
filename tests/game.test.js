import test from 'node:test';
import assert from 'node:assert/strict';
import { getProgress, getXp } from '../src/game.js';

test('el progreso refleja tareas guardadas en la base', () => {
  for (let completed = 0; completed <= 4; completed++) {
    const tasks = Array.from({ length: 4 }, (_, index) => ({ completed: index < completed }));
    assert.equal(getProgress(tasks).rounded, completed * 25);
  }
  assert.equal(getProgress([]).rounded, 0);
});

test('cada tarea completada aporta diez XP', () => {
  assert.equal(getXp(0), 0);
  assert.equal(getXp(1), 10);
  assert.equal(getXp(4), 40);
  assert.equal(getXp(-1), 0);
});
