import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdvisor, createCustomer, completeTask, getProgress, getAdvisorProgress, getMascotState } from '../src/game.js';
import { catalog } from '../src/catalog.js';

test('asesor y cliente comercial tienen identidades distintas y nombres válidos', () => {
  for (const name of ['', '   ', null]) assert.throws(() => createAdvisor(name), /nombre/i);
  assert.equal(createAdvisor(' Ana ').name, 'Ana');
  assert.throws(() => createCustomer('   ', 'Ferretería', 'advisor-1'), /nombre/i);
  assert.throws(() => createCustomer('ABC', 'Ferretería', ''), /asesor/i);
  const customer = createCustomer(' Ferretería Norte ', 'Ferretería', 'advisor-1');
  assert.equal(customer.name, 'Ferretería Norte');
  assert.equal(customer.advisorId, 'advisor-1');
  assert.equal(customer.type, 'Ferretería');
});

test('cada cliente recibe cuatro tareas independientes y persistibles', () => {
  const customers = Array.from({ length: 25 }, (_, i) => createCustomer(`Empresa ${i}`, 'Constructora', 'advisor-1'));
  const ids = customers.flatMap(customer => [customer.id, ...customer.tasks.map(task => task.id)]);
  assert.equal(new Set(ids).size, ids.length);
  for (const customer of customers) {
    assert.equal(customer.tasks.length, 4);
    assert.equal(new Set(customer.tasks.map(task => task.templateId)).size, 4);
    for (const task of customer.tasks) {
      const template = catalog.find(item => item.id === task.templateId);
      assert.equal(task.title, template.title);
      assert.equal(task.description, template.description);
      assert.equal(task.reason, template.reason);
      assert.equal(task.completed, false);
    }
  }
  completeTask(customers[0], customers[0].tasks[0].id);
  assert.equal(completeTask(customers[0], customers[0].tasks[0].id), false);
  assert.equal(getProgress(customers[1].tasks).completed, 0);
  assert.equal(getAdvisorProgress(customers, 'advisor-1').completed, 1);
  assert.equal(getAdvisorProgress(customers, 'another').total, 0);
});

test('progreso y estados dependen de las tareas del cliente', () => {
  const customer = createCustomer('Norte', 'Ferretería', 'advisor-1');
  const states = ['sad', 'sad', 'neutral', 'happy', 'energetic'];
  for (let completed = 0; completed <= 4; completed++) {
    assert.deepEqual(getProgress(customer.tasks), {
      completed, total: 4, percentage: completed * 25,
      rounded: completed * 25, mascot: states[completed],
    });
    if (completed < 4) completeTask(customer, customer.tasks[completed].id);
  }
  assert.equal(getProgress([]).rounded, 0);
  assert.equal(getMascotState(25.5), 'neutral');
});
