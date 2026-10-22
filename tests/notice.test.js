import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function setup() {
  const classes = new Set();
  const timers = new Map();
  let nextId = 0;
  const node = { hidden: true, textContent: '', classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } } };
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const fn = source.slice(source.indexOf('function notice('), source.indexOf('function authError('));
  const notice = runInNewContext(`let noticeTimer; ${fn}; notice;`, {
    document: { querySelector: () => node },
    window: { clearTimeout: id => timers.delete(id), setTimeout: (callback, delay) => { timers.set(++nextId, { callback, delay }); return nextId; } },
  });
  return { notice, node, classes, timers };
}

test('profile photo success uses the existing green toast and automatically dismisses', () => {
  const { notice, node, classes, timers } = setup();
  notice('Foto de perfil actualizada.');
  assert.equal(node.hidden, false);
  assert.equal(node.textContent, 'Foto de perfil actualizada.');
  assert.ok(classes.has('success-notice'));
  assert.equal(classes.has('error-notice'), false);
  const timer = [...timers.values()][0];
  assert.equal(timer.delay, 3200);
  timer.callback();
  assert.equal(node.hidden, true);
});

test('skin toast, loading messages and errors retain their previous behavior', () => {
  const { notice, node, classes, timers } = setup();
  notice('Skin equipada.');
  assert.ok(classes.has('success-notice'));
  assert.equal(timers.size, 1);
  notice('Cargando datos…');
  assert.equal(classes.has('success-notice'), false);
  assert.equal(timers.size, 0);
  notice('No se pudo guardar la foto.', true);
  assert.ok(classes.has('error-notice'));
  assert.equal(classes.has('success-notice'), false);
  assert.equal(node.hidden, false);
  notice('');
  assert.equal(node.hidden, true);
});

test('photo removal uses the same green toast and dismissal timer', () => {
  const { notice, node, classes, timers } = setup();
  notice('Foto de perfil eliminada.');
  assert.ok(classes.has('success-notice'));
  assert.equal(node.textContent, 'Foto de perfil eliminada.');
  const timer = [...timers.values()][0];
  assert.equal(timer.delay, 3200);
  timer.callback();
  assert.equal(node.hidden, true);
});

test('invalid photo warning uses a bottom toast instead of a success banner', () => {
  const { notice, node, classes, timers } = setup();
  notice('Selecciona una imagen JPG, PNG o WebP de máximo 5 MB.', true);
  assert.ok(classes.has('validation-notice'));
  assert.ok(classes.has('error-notice'));
  assert.equal(classes.has('success-notice'), false);
  assert.equal(node.hidden, false);
  const timer = [...timers.values()][0];
  assert.equal(timer.delay, 6000);
  notice('Skin equipada.');
  assert.equal(classes.has('validation-notice'), false);
  assert.ok(classes.has('success-notice'));
  assert.equal(timers.size, 1);
});

test('base notice is floating even without a message-specific toast class', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const base = css.match(/\.notice\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(base, /position:\s*fixed/);
  assert.match(base, /bottom:\s*24px/);
  assert.match(base, /right:\s*24px/);
});
