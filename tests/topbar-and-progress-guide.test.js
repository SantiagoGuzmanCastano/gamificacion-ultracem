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
  assert.match(main, /onGuide: \(\) => showProgressGuide\(\{ mascot: skinHappyImage\(\) \}\)/);
  const guide = readFileSync(new URL('../src/progress-guide.js', import.meta.url), 'utf8');
  assert.match(guide, /dialog\.showModal\(\)/);
  assert.match(guide, /from 'gsap'/);
  const page = readFileSync(new URL('../src/progress-page.js', import.meta.url), 'utf8');
  assert.ok(page.includes("'Repetir instrucciones'"));
});

test('each advisor task opens a Topitín guide and the sidebar card drops the level chip', () => {
  assert.match(main, /openTopitinGuide\(\{ task, client: activeClient/);
  assert.match(main, /'Pregunta a Topitín', 'task-guide-button'/);
  assert.doesNotMatch(main, /profile-card-level/);
  const guide = readFileSync(new URL('../src/topitin-guide.js', import.meta.url), 'utf8');
  for (const title of ['Preparar una visita', 'Contactar al cliente', 'Revisar una cotización', 'Planear el siguiente paso']) assert.ok(guide.includes(`'${title}'`));
});
