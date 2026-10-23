import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20261022215541_points_levels_sales.sql', import.meta.url), 'utf8');

test('progression migration stores bounded points and level state', () => {
  assert.match(migration, /add column if not exists points integer not null default 0/);
  assert.match(migration, /add column if not exists level smallint not null default 1/);
  assert.match(migration, /add column if not exists progression_sales integer not null default 0/);
  assert.match(migration, /mvp_profiles_points_nonnegative/);
  assert.match(migration, /mvp_profiles_level_valid/);
});

test('progression migration rewards only confirmed new actions', () => {
  assert.match(migration, /tasks\.completed_at is null/);
  assert.match(migration, /set points = points \+ 5/);
  assert.match(migration, /points = points \+ 100 \+ level_bonus/);
  assert.match(migration, /progression_sales = progression_sales \+ 1/);
  assert.match(migration, /when current_sales >= 5 then 3/);
  assert.match(migration, /when current_sales >= 1 then 2/);
  assert.match(migration, /level_bonus := 25/);
  assert.match(migration, /on conflict \(client_id\) do nothing/);
});

test('progression ranking uses points after confirmed sales', () => {
  assert.match(migration, /returns table \(advisor_id uuid, full_name text, completed_tasks bigint, points integer/);
  assert.match(migration, /profiles\.points desc/);
  assert.doesNotMatch(migration, /completed_tasks.*xp bigint/);
});
