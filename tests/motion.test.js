import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFETTI_COLORS, confettiVector, formatCount, shakeOffsets } from '../src/motion-utils.js';

test('los contadores usan el formato colombiano con prefijo y sufijo', () => {
  assert.equal(formatCount(1234567.4, { pre: '$' }), '$1.234.567');
  assert.equal(formatCount(3, { suf: ' ventas' }), '3 ventas');
  assert.equal(formatCount(0.6), '1');
});

test('el confeti sale hacia arriba con la velocidad pedida', () => {
  const fixed = values => { let index = 0; return () => values[index++]; };
  const left = confettiVector(fixed([0, 0, .5]));
  assert.ok(Math.abs(left.x + 70) < 1e-9);
  assert.ok(Math.abs(left.y + 24) < 1e-9);
  const up = confettiVector(fixed([.5, 1, 0]), [90, 220]);
  assert.ok(Math.abs(up.x) < 1e-9);
  assert.equal(Math.round(up.y), -244);
  assert.equal(up.rotation, -270);
});

test('la paleta del confeti y el temblor siguen la guía', () => {
  assert.deepEqual(CONFETTI_COLORS, ['#FFC20E', '#1F6FE5', '#1FA971', '#6A3DE0', '#F28C1F']);
  assert.equal(shakeOffsets[0], 0);
  assert.equal(shakeOffsets.at(-1), 0);
});
