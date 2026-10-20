import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, completeTask, getProgress, getMascotState } from '../src/game.js';
import { catalog } from '../src/catalog.js';

test('rechaza nombres vacíos y recorta espacios', () => {
  for (const name of ['', '   ', null, undefined]) {
    assert.throws(() => createClient(name), /nombre/i);
  }
  assert.equal(createClient('  Ana  ').name, 'Ana');
});

test('asigna exactamente cuatro plantillas distintas con contenido copiado e IDs únicos', () => {
  const clients = Array.from({ length: 30 }, () => createClient('Ana'));
  const ids = clients.flatMap(client => [client.id, ...client.tasks.map(task => task.id)]);
  assert.equal(new Set(ids).size, ids.length);
  for (const client of clients) {
    assert.equal(client.tasks.length, 4);
    assert.equal(new Set(client.tasks.map(task => task.templateId)).size, 4);
    for (const task of client.tasks) {
      const template = catalog.find(item => item.id === task.templateId);
      assert.ok(template);
      assert.equal(task.title, template.title);
      assert.equal(task.description, template.description);
      assert.equal(task.reason, template.reason);
      assert.equal(task.completed, false);
      assert.notEqual(task, template);
    }
  }
});

test('finalización idempotente e independiente entre participantes', () => {
  const ana = createClient('Ana');
  const luis = createClient('Luis');
  assert.equal(completeTask(ana, ana.tasks[0].id), true);
  assert.equal(completeTask(ana, ana.tasks[0].id), false);
  assert.equal(completeTask(ana, 'inexistente'), false);
  assert.equal(getProgress(ana.tasks).completed, 1);
  assert.equal(getProgress(luis.tasks).completed, 0);
  ana.tasks[0].title = 'Copia modificada';
  assert.ok(catalog.every(task => task.title !== 'Copia modificada'));
});

test('el progreso y mascota corresponden a 0, 1, 2, 3 y 4 tareas completadas', () => {
  const client = createClient('Ana');
  const states = ['sad', 'sad', 'neutral', 'happy', 'energetic'];
  for (let completed = 0; completed <= 4; completed++) {
    assert.deepEqual(getProgress(client.tasks), {
      completed, total: 4, percentage: completed * 25,
      rounded: completed * 25, mascot: states[completed],
    });
    if (completed < 4) completeTask(client, client.tasks[completed].id);
  }
});

test('cero tareas devuelve cero y los decimales se clasifican sin redondear', () => {
  assert.deepEqual(getProgress([]), {
    completed: 0, total: 0, percentage: 0, rounded: 0, mascot: 'sad',
  });
  for (const [percentage, expected] of [
    [0, 'sad'], [25, 'sad'], [25.01, 'neutral'], [25.5, 'neutral'],
    [50, 'neutral'], [50.01, 'happy'], [75, 'happy'],
    [75.01, 'energetic'], [100, 'energetic'],
  ]) assert.equal(getMascotState(percentage), expected);
  const tasks = Array.from({ length: 7 }, (_, i) => ({ completed: i < 2 }));
  assert.equal(getProgress(tasks).rounded, 29);
  assert.equal(getProgress(tasks).mascot, 'neutral');
});
