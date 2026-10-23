import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('theme lives in Perfil › Apariencia and the notification bell lives in the top bar', () => {
  assert.doesNotMatch(main, /theme-button/);
  assert.match(main, /theme: \{ mode: themeMode, set: setThemeMode \}/);
  const profileView = readFileSync(new URL('../src/profile-view.js', import.meta.url), 'utf8');
  for (const label of ['Automático', 'Claro', 'Oscuro']) assert.ok(profileView.includes(`'${label}'`));
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

test('the map heat legend can be collapsed', () => {
  const map = readFileSync(new URL('../src/advisor-map.js', import.meta.url), 'utf8');
  assert.match(map, /class="map-heat-toggle" aria-expanded="true"/);
  const css = readFileSync(new URL('../src/advisor.css', import.meta.url), 'utf8');
  assert.match(css, /\.map-heat-legend\.is-collapsed \.map-heat-body \{ display: none; \}/);
});

test('the target-zone card on the map can be collapsed', () => {
  const zone = readFileSync(new URL('../src/zone-opportunity.js', import.meta.url), 'utf8');
  assert.match(zone, /'map-target-toggle'/);
  const css = readFileSync(new URL('../src/advisor.css', import.meta.url), 'utf8');
  assert.match(css, /\.map-target-card\.is-collapsed \.map-target-reason, \.map-target-card\.is-collapsed \.map-target-go \{ display: none; \}/);
});

test('ranking shows a crown and medals for the podium and no level goal in the sidebar card', () => {
  assert.match(main, /function rankBadge\(position, placeholder = false\)/);
  assert.match(main, /rankBadge\(row\.position, row\.placeholder\)/);
  assert.doesNotMatch(main, /profile-card-goal/);
  const entrance = readFileSync(new URL('../src/advisor-entrance.js', import.meta.url), 'utf8');
  assert.ok(entrance.includes('.advisor-ranking .rank-medal svg'));
});

test('only the next level label shows the missing sales, and Progreso has a GSAP entrance', () => {
  const page = readFileSync(new URL('../src/progress-page.js', import.meta.url), 'utf8');
  assert.match(page, /level\.level === model\.next\.level && model\.remaining > 0/);
  assert.match(page, /'progress-label-hint'/);
  assert.match(page, /export function playProgressEntrance\(page\)/);
  assert.match(main, /playProgressEntrance\(page\);/);
});

test('Inicio has a Topitín guide button under the welcome title', () => {
  assert.match(main, /'¿Cómo funciona esta pantalla\?', 'advisor-guide-button', \(\) => showDashboardGuide/);
  const guide = readFileSync(new URL('../src/progress-guide.js', import.meta.url), 'utf8');
  assert.match(guide, /export function showDashboardGuide\(\{ mascot \}\)/);
  for (const title of ['Tus números de hoy', 'Completa las 4 tareas', 'Confirma la venta', 'Ranking y meta del mes']) assert.ok(guide.includes(`'${title}'`));
});
