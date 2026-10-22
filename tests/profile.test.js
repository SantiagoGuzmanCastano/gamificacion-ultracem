import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidProfileImage, profileImageExtension, profileImageMaxBytes } from '../src/profile.js';

test('acepta imágenes de perfil válidas y limita el tamaño', () => {
  assert.equal(isValidProfileImage({ type: 'image/jpeg', size: 1024 }), true);
  assert.equal(isValidProfileImage({ type: 'image/png', size: profileImageMaxBytes }), true);
  assert.equal(isValidProfileImage({ type: 'image/svg+xml', size: 1024 }), false);
  assert.equal(isValidProfileImage({ type: 'image/jpeg', size: profileImageMaxBytes + 1 }), false);
});

test('conserva una extensión segura para la ruta de Storage', () => {
  assert.equal(profileImageExtension({ type: 'image/png' }), 'png');
  assert.equal(profileImageExtension({ type: 'image/webp' }), 'webp');
  assert.equal(profileImageExtension({ type: 'image/jpeg' }), 'jpg');
});
