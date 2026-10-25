import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/game.js';

const { getProgress, getXp, getMascotStateForCurrentClient, getLevelProgress } = game;

test('el progreso refleja tareas guardadas en la base', () => {
  for (let completed = 0; completed <= 4; completed++) {
    const tasks = Array.from({ length: 4 }, (_, index) => ({ completed: index < completed }));
    assert.equal(getProgress(tasks).rounded, completed * 25);
  }
  assert.equal(getProgress([]).rounded, 0);
});

test('la mascota solo cambia de ánimo cuando hay cliente actual', () => {
  const clientWith = completed => ({ tasks: Array.from({ length: 4 }, (_, index) => ({ completed: index < completed })) });

  assert.equal(getMascotStateForCurrentClient(null), 'happy');
  assert.equal(getMascotStateForCurrentClient(clientWith(0)), 'sad');
  assert.equal(getMascotStateForCurrentClient(clientWith(1)), 'sad');
  assert.equal(getMascotStateForCurrentClient(clientWith(2)), 'neutral');
  assert.equal(getMascotStateForCurrentClient(clientWith(3)), 'neutral');
  assert.equal(getMascotStateForCurrentClient(clientWith(4)), 'happy');
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

test('el progreso de nivel usa ventas confirmadas', () => {
  assert.deepEqual(getLevelProgress(1, 0), { level: 1, sales: 0, target: 1, percentage: 0 });
  assert.deepEqual(getLevelProgress(2, 2), { level: 2, sales: 2, target: 3, percentage: 50 });
  assert.deepEqual(getLevelProgress(4, 6), { level: 4, sales: 6, target: 8, percentage: 33 });
  assert.deepEqual(getLevelProgress(7, 20), { level: 7, sales: 20, target: null, percentage: 100 });
  // A profile still stored with the old three-level cap follows its confirmed sales.
  assert.equal(getLevelProgress(3, 5).level, 4);
});

test('confirma la animación solo cuando la base guardó la tarea', () => {
  assert.equal(typeof game.isTaskCompletionConfirmed, 'function');
  assert.equal(game.isTaskCompletionConfirmed({ data: true, error: null }), true);
  assert.equal(game.isTaskCompletionConfirmed({ data: false, error: null }), false);
  assert.equal(game.isTaskCompletionConfirmed({ data: true, error: new Error('fallo') }), false);
});

test('muestra frases de ánimo cada dos tareas completadas', () => {
  assert.equal(typeof game.shouldShowEncouragement, 'function');
  assert.equal(game.shouldShowEncouragement(1), false);
  assert.equal(game.shouldShowEncouragement(2), true);
  assert.equal(game.shouldShowEncouragement(3), false);
  assert.equal(game.shouldShowEncouragement(4), true);
});
