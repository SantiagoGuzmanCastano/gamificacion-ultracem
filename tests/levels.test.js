import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVELS, MAX_LEVEL, levelForSales } from '../src/levels.js';

const migration = readFileSync(new URL('../supabase/migrations/20261023200000_advisor_levels.sql', import.meta.url), 'utf8');

test('los niveles del cliente coinciden con public.mvp_levels', () => {
  const seeded = [...migration.matchAll(/\((\d), '([^']+)', (\d+), (\d+)\)/g)]
    .map(([, level, name, minSales, reward]) => ({ level: Number(level), name, minSales: Number(minSales), reward: Number(reward) }));
  assert.deepEqual(seeded, LEVELS);
  assert.equal(MAX_LEVEL, 7);
});

test('el nivel sale de las ventas confirmadas acumuladas', () => {
  assert.equal(levelForSales(0), 1);
  assert.equal(levelForSales(1), 2);
  assert.equal(levelForSales(2), 2);
  assert.equal(levelForSales(5), 4);
  assert.equal(levelForSales(16), 7);
  assert.equal(levelForSales(99), 7);
  assert.equal(levelForSales(-3), 1);
});

test('la migración amplía el nivel a 7, calcula con la tabla y protege los datos', () => {
  assert.match(migration, /check \(level between 1 and 7\)/);
  assert.match(migration, /current_level := greatest\(previous_level, public\.mvp_level_for_sales\(current_sales\)\)/);
  assert.match(migration, /alter table public\.mvp_levels enable row level security/);
  assert.match(migration, /for select to authenticated using \(true\)/);
  assert.match(migration, /where profiles\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /revoke all on function public\.get_my_level_progress\(\) from public, anon/);
  // La recompensa solo se muestra: la comisión sigue usando la tasa global.
  assert.match(migration, /commission := round\(requested_tons \* price_per_ton \* rate, 2\)/);
  assert.doesNotMatch(migration, /reward_amount.*commission/);
});
