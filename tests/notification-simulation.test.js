import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('email provider is archived from active notification flows', () => {
  assert.equal((app.match(/notifyEmail\(/g) || []).length, 1);
  assert.match(app, /Topitín ya avisó/);
  assert.doesNotMatch(app, /correo simulado/);
  assert.doesNotMatch(app, /notifyEmail\('client_assigned'/);
  assert.doesNotMatch(app, /notifyEmail\('client_request'/);
});
