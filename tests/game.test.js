import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/game.js';

const { getProgress, getXp } = game;

test('el progreso refleja tareas guardadas en la base', () => {
  for (let completed = 0; completed <= 4; completed++) {
    const tasks = Array.from({ length: 4 }, (_, index) => ({ completed: index < completed }));
    assert.equal(getProgress(tasks).rounded, completed * 25);
  }
  assert.equal(getProgress([]).rounded, 0);
});

test('solo marca la última tarea pendiente para celebración en 3/4', () => {
  const tasks = Array.from({ length: 4 }, (_, index) => ({ completed: index < 3 }));
  assert.equal(getProgress(tasks).isLastTaskPending, true);
  assert.equal(getProgress(tasks.slice(0, 3)).isLastTaskPending, false);
  assert.equal(getProgress(tasks.map(task => ({ ...task, completed: true }))).isLastTaskPending, false);
  assert.equal(getProgress([]).isLastTaskPending, false);
});

test('cada tarea completada aporta diez XP', () => {
  assert.equal(getXp(0), 0);
  assert.equal(getXp(1), 10);
  assert.equal(getXp(4), 40);
  assert.equal(getXp(-1), 0);
});

test('confirma la animación solo cuando la base guardó la tarea', () => {
  assert.equal(typeof game.isTaskCompletionConfirmed, 'function');
  assert.equal(game.isTaskCompletionConfirmed({ data: true, error: null }), true);
  assert.equal(game.isTaskCompletionConfirmed({ data: false, error: null }), false);
  assert.equal(game.isTaskCompletionConfirmed({ data: true, error: new Error('fallo') }), false);
});

test('la burbuja de Topitín cambia según las tareas completadas', () => {
  assert.equal(game.getMascotCheer(1), '¡Excelente trabajo!');
  assert.equal(game.getMascotCheer(2), '¡Vas con todo!');
  assert.equal(game.getMascotCheer(3), '¡Una más!');
  assert.equal(game.getMascotCheer(4), '¡Lo lograste!');
  assert.equal(game.getMascotCheer(0), '¡Excelente trabajo!');
  assert.equal(game.getMascotCheer(9), '¡Lo lograste!');
});
