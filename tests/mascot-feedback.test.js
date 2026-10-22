import test from 'node:test';
import assert from 'node:assert/strict';
import { getMascotFeedbackMessage } from '../src/mascot-feedback.js';

test('mascot speaks for successful actions, not map navigation', () => {
  for (const event of ['load', 'theme', 'navigate', 'map', 'error', undefined]) {
    assert.equal(getMascotFeedbackMessage(event), null);
  }
  for (const completed of [1, 2, 3, 4]) {
    assert.ok(getMascotFeedbackMessage('task', completed));
  }
  assert.equal(getMascotFeedbackMessage('sale'), '¡Venta confirmada! ¡Buen trabajo!');
});
