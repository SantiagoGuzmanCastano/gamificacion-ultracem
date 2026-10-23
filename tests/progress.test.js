import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { getProgressModel } from '../src/progress-model.js';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/progress-scene.js', import.meta.url), 'utf8');

test('el modelo marca islas completadas, actual y bloqueadas con la siguiente meta', () => {
  const model = getProgressModel(1, 4);
  assert.equal(model.level, 3);
  assert.deepEqual(model.levels.map(level => level.state), ['completed', 'completed', 'current', 'locked', 'locked', 'locked', 'locked']);
  assert.equal(model.current.reward, 150000);
  assert.equal(model.next.level, 4);
  assert.equal(model.remaining, 1);
});

test('en el nivel máximo no hay siguiente recompensa', () => {
  const model = getProgressModel(7, 20);
  assert.equal(model.next, null);
  assert.equal(model.remaining, 0);
  assert.ok(model.levels.slice(0, 6).every(level => level.state === 'completed'));
});

test('las filas de public.mvp_levels reemplazan los nombres y recompensas locales', () => {
  const model = getProgressModel(2, 1, [{ level: 2, name: 'Desde el servidor', min_confirmed_sales: 1, reward_amount: '123000.00' }]);
  assert.equal(model.current.name, 'Desde el servidor');
  assert.equal(model.current.reward, 123000);
  assert.equal(model.levels[0].name, 'Bienvenido al equipo');
});

test('Progreso está en el menú, carga la escena 3D bajo demanda y la destruye al salir', () => {
  assert.match(main, /\['progress', 'Progreso', 'flag'\]/);
  assert.match(main, /progress: 'Progreso'/);
  assert.match(main, /import\('\.\/progress-scene\.js'\)/);
  assert.doesNotMatch(main, /from '\.\/progress-scene\.js'/);
  assert.match(main, /advisorView !== 'progress'\) \{ destroyProgressWorld\(\); resetProgressEntrance\(\); \}/);
  assert.match(main, /db\.rpc\('get_my_level_progress'\)/);
});

test('la escena usa solo modelos copiados a public/progress', () => {
  const names = new Set([...scene.matchAll(/'((?:industrial|platformer|car)\/[a-z-]+)'/g)].map(match => match[1]));
  assert.ok(names.size > 10);
  for (const name of names) assert.ok(existsSync(new URL(`../public/progress/${name}.glb`, import.meta.url)), name);
  for (const pack of ['industrial', 'platformer', 'car']) assert.ok(existsSync(new URL(`../public/progress/${pack}/Textures/colormap.png`, import.meta.url)), pack);
});
