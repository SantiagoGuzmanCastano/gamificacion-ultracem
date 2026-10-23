import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class Element {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.attributes = {}; this.events = {}; this.className = ''; this.dataset = {};
    this.classList = { add: name => { if (!this.className.split(' ').includes(name)) this.className += ` ${name}`; }, remove: name => { this.className = this.className.split(' ').filter(item => item !== name).join(' '); } };
  }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.text = ''; this.append(...nodes); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, callback) { this.events[name] = callback; }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  focus() { this.focused = true; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(selector.startsWith('.') ? child.className.split(' ').includes(selector.slice(1)) : child.tagName === selector) ? [child] : [], ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0]; }
  async click() { if (!this.disabled) await this.events.click?.({ detail: 1 }); }
}

function setup(options = {}) {
  const listeners = new Map();
  const document = { createElement: tag => new Element(tag), addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) };
  const source = readFileSync(new URL('../src/notification-center.js', import.meta.url), 'utf8').replace('export function', 'function');
  const create = vm.runInNewContext(`${source}\ncreateNotificationCenter`, { document, Intl, Date });
  const host = new Element('div');
  const reads = [], actions = [];
  const center = create(host, { role: 'advisor', notifications: [{ id: '1', title: '¡Topitín tiene una nueva misión! 🐧', body: 'Cliente A en Tunja', kind: 'client_assigned', created_at: '2026-10-22T20:00:00Z', read_at: null }, { id: '2', title: 'Otra misión', body: 'Cliente B', kind: 'client_assigned', read_at: null }], onRead: async item => { reads.push(item.id); }, onAction: async item => { actions.push(item.id); }, ...options });
  return { host, center, reads, actions, listeners };
}

test('bell opens latest notifications without marking all read', async () => {
  const { host, reads } = setup();
  const bell = host.querySelector('.notification-bell');
  assert.match(bell.attributes['aria-label'], /2/);
  assert.equal(host.querySelector('.notification-panel').hidden, true);
  await bell.click();
  assert.equal(host.querySelector('.notification-panel').hidden, false);
  assert.match(host.textContent, /Topitín/);
  assert.deepEqual(reads, []);
  assert.equal(host.querySelector('.notification-unread-dot').hidden, false);
});

test('reading one item requires the explicit button and role action works', async () => {
  const { host, reads, actions } = setup();
  await host.querySelector('.notification-bell').click();
  await host.querySelectorAll('.notification-mark-read')[0].click();
  assert.deepEqual(reads, ['1']);
  assert.match(host.querySelector('.notification-bell').attributes['aria-label'], /1/);
  await host.querySelectorAll('.notification-action')[0].click();
  assert.deepEqual(actions, ['1']);
  assert.match(host.textContent, /Ver mis próximas acciones/);
});

test('administrator has assignment action, empty state and refresh', async () => {
  const { host, reads } = setup({ role: 'admin', notifications: [], onRefresh: async () => [{ id: '3', kind: 'client_request', title: 'Solicitud de cliente', body: 'Ana solicitó un nuevo cliente.', read_at: null }] });
  assert.match(host.textContent, /No tienes notificaciones/);
  await host.querySelector('.notification-bell').click();
  assert.match(host.textContent, /Asignar cliente/);
  assert.match(host.textContent, /Ana solicitó/);
  assert.deepEqual(reads, []);
});

test('failed read keeps unread dot and shows an error', async () => {
  const { host } = setup({ onRead: async () => { throw new Error('No se pudo marcar como leída.'); } });
  await host.querySelector('.notification-bell').click();
  await host.querySelector('.notification-mark-read').click();
  assert.equal(host.querySelector('.notification-unread-dot').hidden, false);
  assert.match(host.querySelector('.notification-feedback').textContent, /No se pudo/);
});

test('escape, outside click and destroy clean up without reading notifications', async () => {
  const { host, center, listeners, reads } = setup();
  const bell = host.querySelector('.notification-bell');
  await bell.click();
  listeners.get('keydown')({ key: 'Escape' });
  assert.equal(host.querySelector('.notification-panel').hidden, true);
  assert.equal(bell.focused, true);
  await bell.click();
  listeners.get('pointerdown')({ target: new Element('div') });
  assert.equal(host.querySelector('.notification-panel').hidden, true);
  center.destroy();
  assert.equal(listeners.size, 0);
  assert.equal(host.querySelector('.notification-center'), undefined);
  assert.deepEqual(reads, []);
});

test('realtime update retains open panel and user content is text, not HTML', async () => {
  const { host, center } = setup();
  await host.querySelector('.notification-bell').click();
  center.update([{ id: '4', title: '<img onerror=alert(1)>', body: 'Nueva', read_at: null }]);
  assert.equal(host.querySelector('.notification-panel').hidden, false);
  assert.match(host.textContent, /<img onerror/);
  assert.equal(host.querySelector('img'), undefined);
});

test('clears read notifications without clearing unread notifications', async () => {
  let cleared = 0;
  const { host, center } = setup({
    notifications: [{ id: '1', title: 'Leída', body: 'Lista', read_at: '2026-10-22T20:00:00Z' }, { id: '2', title: 'Nueva', body: 'Pendiente', read_at: null }],
    onClearRead: async () => { cleared += 1; center.update([{ id: '2', title: 'Nueva', body: 'Pendiente', read_at: null }]); },
  });
  await host.querySelector('.notification-bell').click();
  assert.equal(host.querySelector('.notification-clear-read').hidden, false);
  await host.querySelector('.notification-clear-read').click();
  assert.equal(cleared, 1);
  assert.equal(host.querySelectorAll('.notification-item').length, 1);
  assert.match(host.textContent, /Pendiente/);
  assert.doesNotMatch(host.textContent, /Leída/);
});

test('actual advisor action selects the assigned client and focuses current actions', async () => {
  const app = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const source = app.slice(app.indexOf('async function openNotification('), app.indexOf('function startNotificationSync('));
  const target = { focus() { this.focused = true; }, scrollIntoView() { this.scrolled = true; } };
  let refreshed = false, rendered = false;
  const context = vm.createContext({ profile: { role: 'advisor' }, selectedId: null, advisorView: 'map', loadData: async () => { refreshed = true; }, render: () => { rendered = true; }, document: { querySelector: selector => selector === '#advisor-actions' ? target : null } });
  await vm.runInContext(`${source}\nopenNotification({ kind: 'client_assigned', related_client_id: 'client-2' })`, context);
  assert.equal(context.selectedId, 'client-2');
  assert.equal(context.advisorView, 'dashboard');
  assert.ok(refreshed && rendered && target.focused && target.scrolled);
});

test('advisor realtime assignment opens current actions immediately', async () => {
  const app = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const source = app.slice(app.indexOf('function startNotificationSync()'), app.indexOf('function shell()'));
  let realtime;
  const context = vm.createContext({
    db: { removeChannel() {}, channel() { return { on(_event, _filter, callback) { realtime = callback; return this; }, subscribe() {} }; } },
    user: { id: 'advisor-1' }, profile: { role: 'advisor' }, notificationChannel: null, notifications: [], notificationCenter: { update() {} }, notice() {}, openNotification: async notification => { context.opened = notification; },
  });
  vm.runInContext(`${source}\nstartNotificationSync()`, context);
  realtime({ new: { id: 'n1', kind: 'client_assigned', related_client_id: 'c1', title: 'Nueva misión', body: 'Cliente nuevo', read_at: null } });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(context.opened.related_client_id, 'c1');
});

test('actual admin action opens assignment form with requesting advisor selected', async () => {
  const app = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const source = app.slice(app.indexOf('async function openNotification('), app.indexOf('function startNotificationSync('));
  const select = {}, name = { focus() { this.focused = true; } };
  const form = { scrollIntoView() {}, querySelector: () => name };
  const query = { select() { return this; }, eq() { return this; }, single: async () => ({ data: { advisor_id: 'advisor-2' } }) };
  const context = vm.createContext({ profile: { role: 'admin' }, advisors: [{ user_id: 'advisor-2' }], adminView: 'shop', db: { from: () => query }, render() {}, document: { querySelector: selector => selector === '#notification-assigned-advisor' ? select : form } });
  await vm.runInContext(`${source}\nopenNotification({ kind: 'client_request', related_request_id: 'request-1' })`, context);
  assert.equal(context.adminView, 'manage');
  assert.equal(select.value, 'advisor-2');
  assert.equal(name.focused, true);
});

test('admin cannot mark a pending client request as read before assignment', async () => {
  const app = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const source = app.slice(app.indexOf('async function markNotificationsRead('), app.indexOf('async function openNotification('));
  let marked = false;
  const query = { select() { return this; }, eq() { return this; }, single: async () => ({ data: { status: 'pending' } }) };
  const context = vm.createContext({ profile: { role: 'admin' }, notifications: [], db: { from: () => query, rpc: async () => { marked = true; return { data: true }; } }, Date });
  await assert.rejects(() => vm.runInContext(`${source}\nmarkNotificationsRead({ id: 'n1', kind: 'client_request', related_request_id: 'r1', read_at: null })`, context), /Asigna el cliente/);
  assert.equal(marked, false);
});

test('a stale refresh cannot restore a notification already read successfully', async () => {
  let finishRefresh;
  const { host } = setup({ onRefresh: () => new Promise(resolve => { finishRefresh = resolve; }) });
  const opening = host.querySelector('.notification-bell').click();
  await host.querySelector('.notification-mark-read').click();
  assert.match(host.querySelector('.notification-bell').attributes['aria-label'], /1 sin leer/);
  finishRefresh([{ id: '1', title: 'Misión A', read_at: null }, { id: '2', title: 'Misión B', read_at: null }]);
  await opening;
  assert.match(host.querySelector('.notification-bell').attributes['aria-label'], /1 sin leer/);
  assert.equal(host.querySelector('.notification-read-state').textContent, 'Leída');
});
