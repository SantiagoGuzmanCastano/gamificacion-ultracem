import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('theme follows the device and the notification bell lives in the top bar', () => {
  assert.doesNotMatch(main, /theme-button|ultracem-theme/);
  assert.match(main, /matchMedia\('\(prefers-color-scheme: dark\)'\)/);
  assert.match(main, /createNotificationCenter\(actions, \{/);
  const css = readFileSync(new URL('../src/notification-center.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.notification-center\s*\{[^}]*position: fixed/);
});

test('progress guide opens once per advisor and can be reopened from the heading', () => {
  assert.match(main, /const guideKey = `ultracem-progress-guide-\$\{user\.id\}`/);
  assert.match(main, /onGuide: \(\) => showProgressGuide\(\)/);
  const page = readFileSync(new URL('../src/progress-page.js', import.meta.url), 'utf8');
  assert.match(page, /dialog\.showModal\(\)/);
  assert.ok(page.includes("'¿Cómo funciona?'"));
});
