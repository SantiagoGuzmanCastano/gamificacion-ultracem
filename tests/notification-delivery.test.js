import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformWithOxc } from 'vite';
import vm from 'node:vm';

const { code: source } = await transformWithOxc(readFileSync(new URL('../supabase/functions/send-notification-email/index.ts', import.meta.url), 'utf8')
  .replace(/^import .*createClient.*;\r?\n/, ''), 'index.ts');
const app = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const callerSource = app.slice(app.indexOf('async function notifyEmail('), app.indexOf('async function markNotificationsRead('));
function callEmail(invoke) {
  const context = vm.createContext({ db: { functions: { invoke } } });
  return vm.runInContext(`${callerSource}\nnotifyEmail('client_request', 'event-1')`, context);
}

function harness({ queryError = null, email = 'advisor@example.test', providerStatus = 200, providerBody = { id: 'email-1' }, providerThrows = false, rows } = {}) {
  const requests = [];
  let handler;
  const admin = {
    auth: { admin: { getUserById: async () => ({ data: { user: { email } } }) } },
    from(table) {
      const result = table === 'mvp_notifications'
        ? { data: rows ?? [{ id: 'notice-1', recipient_id: 'advisor-1', title: 'Solicitud de cliente', body: 'Nuevo cliente' }], error: queryError }
        : { data: table === 'mvp_clients' ? { name: 'A & B', type: 'Ferretería', city: 'Tunja', department: 'Boyacá' } : table === 'mvp_profiles' ? { role: 'admin', full_name: 'Ana <Test>' } : { id: 'event-1', advisor_id: 'caller' }, error: null };
      return { select() { return this; }, eq() { return this; }, single: async () => result, then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
    },
  };
  const env = { SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', RESEND_API_KEY: 'secret', RESEND_FROM: 'Ultracem <notificaciones@ultracemcrm.com>', APP_URL: 'https://example.test' };
  vm.runInNewContext(source, {
    Deno: { env: { get: name => env[name] }, serve: callback => { handler = callback; } },
    createClient: (_url, key) => key === 'anon' ? { auth: { getUser: async () => ({ data: { user: { id: 'caller' } } }) } } : admin,
    Request, Response, Error, console: { error() {} },
    fetch: async (url, options) => { if (providerThrows) throw new Error('secret=canary'); requests.push({ url, ...options }); return Response.json(providerBody, { status: providerStatus }); },
  });
  return { requests, send: (eventType = 'client_request') => handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: eventType, event_id: 'event-1' }) })) };
}

test('notification query failure is not reported as a successful email', async () => {
  const { send, requests } = harness({ queryError: { message: 'unavailable' }, rows: [] });
  assert.equal((await send()).status, 500);
  assert.equal(requests.length, 0);
});

test('missing recipient email is a failure, not a sent email', async () => {
  const { send, requests } = harness({ email: null });
  assert.equal((await send()).status, 422);
  assert.equal(requests.length, 0);
});

test('empty notification list cannot claim successful delivery', async () => {
  assert.equal((await harness({ rows: [] }).send()).status, 404);
});

test('provider rejection returns a useful safe error code', async () => {
  const response = await harness({ providerStatus: 403, providerBody: { name: 'validation_error', message: 'Private recipient data' } }).send();
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.provider_status, 403);
  assert.equal(body.provider_code, 'validation_error');
  assert.doesNotMatch(JSON.stringify(body), /Private recipient data/);
});

test('successful retries use the same notification idempotency key', async () => {
  const { send, requests } = harness();
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 200);
  assert.equal(requests[0].headers['Idempotency-Key'], 'mvp-notification/notice-1');
  assert.equal(requests[1].headers['Idempotency-Key'], requests[0].headers['Idempotency-Key']);
});

test('assignment email preserves Topitin, details and HTML escaping', async () => {
  const { send, requests } = harness();
  assert.deepEqual(await (await send('client_assigned')).json(), { sent: 1 });
  const payload = JSON.parse(requests[0].body);
  assert.match(payload.subject, /Topitín.*A & B/);
  assert.match(payload.html, /A &amp; B/);
  assert.match(payload.html, /Ana &lt;Test&gt;/);
  assert.match(payload.html, /Tunja/);
  assert.match(payload.html, /Boyacá/);
});

test('frontend exposes returned function errors instead of silently succeeding', async () => {
  const message = await callEmail(async () => ({ error: { context: Response.json({ error: 'Verifica el dominio remitente en Resend.' }) } }));
  assert.match(message, /dominio remitente/);
});

test('frontend reports zero sends and network failures', async () => {
  assert.match(await callEmail(async () => ({ data: { sent: 0 } })), /ningún correo/);
  assert.match(await callEmail(async () => { throw new Error('network'); }), /conectar/);
});

test('frontend accepts provider-confirmed submission', async () => {
  assert.equal(await callEmail(async () => ({ data: { sent: 1 } })), null);
});

test('provider acceptance requires an email identifier', async () => {
  assert.equal((await harness({ providerBody: {} }).send()).status, 502);
});

test('unexpected exceptions do not expose transport diagnostics', async () => {
  const response = await harness({ providerThrows: true }).send();
  assert.equal(response.status, 500);
  assert.doesNotMatch(JSON.stringify(await response.json()), /canary|secret/);
});
