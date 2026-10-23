import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20261022232253_client_notifications.sql', import.meta.url), 'utf8');
const topitinMigration = readFileSync(new URL('../supabase/migrations/20261023000637_topitin_assignment_notifications.sql', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const emailFunction = readFileSync(new URL('../supabase/functions/send-notification-email/index.ts', import.meta.url), 'utf8');

test('notification migration keeps requests and recipients isolated', () => {
  assert.match(migration, /create table public\.mvp_client_requests/);
  assert.match(migration, /create unique index mvp_client_requests_one_pending_per_advisor/);
  assert.match(migration, /create table public\.mvp_notifications/);
  assert.match(migration, /recipient_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /create or replace function public\.request_mvp_client\(\)/);
  assert.match(migration, /on conflict \(advisor_id\) where status = 'pending' do nothing/);
  assert.match(migration, /create or replace function public\.assign_mvp_client/);
  assert.match(migration, /create function public\.mark_mvp_notification_read/);
  assert.match(migration, /alter publication supabase_realtime add table public\.mvp_notifications/);
});

test('notification flow enables advisor requests, assignment notices and optional email', () => {
  assert.match(app, /db\.rpc\('request_mvp_client'\)/);
  assert.match(app, /db\.rpc\('assign_mvp_client'/);
  assert.match(app, /send-notification-email/);
  assert.match(app, /postgres_changes/);
  assert.doesNotMatch(app, /request\.disabled = true/);
});

test('advisor assignment notification uses Topitin and client location', () => {
  assert.match(topitinMigration, /Topitín tiene una nueva misión/);
  assert.match(topitinMigration, /client_name/);
  assert.match(topitinMigration, /target_city/);
  assert.match(topitinMigration, /target_department/);
});

test('advisor assignment email includes the dynamic client details', () => {
  assert.match(emailFunction, /mvp_clients/);
  assert.match(emailFunction, /Topitín te trae una nueva misión/);
  assert.match(emailFunction, /RESEND_FROM/);
  assert.match(emailFunction, /APP_URL/);
  assert.match(emailFunction, /escapeHtml/);
});
