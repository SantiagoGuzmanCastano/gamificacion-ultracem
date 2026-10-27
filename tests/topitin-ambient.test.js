import test from 'node:test';
import assert from 'node:assert/strict';
import { moodReasons, nextAmbientLine, notificationReminders, pendingReminders } from '../src/topitin-ambient.js';

test('Topitín explains why he is sad or serious, never when happy', () => {
  assert.deepEqual(moodReasons({ mood: 'happy', completed: 4, client: 'Ferretería Norte' }), []);
  const sad = moodReasons({ mood: 'sad', completed: 0, client: 'Ferretería Norte' });
  assert.ok(sad.length >= 2 && sad.every(line => line.includes('Ferretería Norte')));
  assert.ok(moodReasons({ mood: 'sad', completed: 1, client: 'A' }).some(line => /1 de 4/.test(line)));
  assert.ok(moodReasons({ mood: 'neutral', completed: 2, client: 'A' }).some(line => /2 de 4/.test(line)));
  assert.ok(moodReasons({ mood: 'neutral', completed: 3, client: 'A' }).every(line => /1 tarea/.test(line)));
  assert.deepEqual(moodReasons({ mood: 'sad', completed: 0, client: '' }), []);
});

test('pending commissions, unseen levels and notifications become reminders', () => {
  assert.match(pendingReminders({ claimable: 1, claimableAmount: 120000 })[0], /\$ 120\.000.*Cartera/);
  assert.match(pendingReminders({ newLevel: true })[0], /Progreso/);
  assert.deepEqual(pendingReminders({}), []);
  assert.match(notificationReminders({ unread: 2 })[0], /2 notificaciones sin leer/);
  assert.match(notificationReminders({ unread: 0 })[0], /notificaciones/);
});

test('the next line avoids repeating and is empty when there is nothing to say', () => {
  const context = { mood: 'sad', completed: 0, client: 'A', claimable: 1, claimableAmount: 5000 };
  const first = nextAmbientLine(context, '', () => .1);
  assert.ok(first);
  for (let i = 0; i < 20; i++) assert.notEqual(nextAmbientLine(context, first, Math.random), first);
  assert.equal(nextAmbientLine({ mood: 'happy' }, '', () => .9), '');
  // Al entrar a Inicio siempre dice algo, aunque esté feliz y no haya pendientes.
  assert.match(nextAmbientLine({ mood: 'happy' }, '', () => .9, { always: true }), /notificaciones/);
});

test('sad lines promise feeling better, not an instant smile', () => {
  const lines = moodReasons({ mood: 'sad', completed: 0, client: 'A' }).concat(moodReasons({ mood: 'sad', completed: 1, client: 'A' }));
  assert.ok(lines.every(line => !/me sale una sonrisa|me anima/.test(line)));
  assert.ok(lines.some(line => /me voy a sentir mejor/.test(line)));
});
