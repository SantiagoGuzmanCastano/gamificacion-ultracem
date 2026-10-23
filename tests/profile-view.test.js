import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

class Element {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.events = {}; this.dataset = {}; this.style = {}; this.className = ''; this.textContent = ''; this.classList = { add: name => { this.className += ` ${name}`; }, toggle: (name, active) => { if (active) this.className += ` ${name}`; } }; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.text = value; this.children = []; }
  append(...nodes) { nodes.forEach(node => { node.parent = this; this.children.push(node); }); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, handler) { this.events[name] = handler; }
  replaceWith(node) { this.parent.children[this.parent.children.indexOf(this)] = node; }
  querySelectorAll(selector) {
    return this.children.flatMap(child => {
      const matches = selector.startsWith('.') ? child.className.split(' ').includes(selector.slice(1)) : child.tagName === selector.toUpperCase();
      return [...(matches ? [child] : []), ...child.querySelectorAll(selector)];
    });
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  click() { this.clicked = true; this.events.click?.({ detail: 1 }); }
}

function setup({ reducedMotion = false } = {}) {
  const calls = [];
  let reverted = 0;
  const source = readFileSync(new URL('../src/profile-view.js', import.meta.url), 'utf8')
    .replace(/^import .*;$/gm, '').replaceAll('export function', 'function');
  const api = runInNewContext(`${source}\n({ createProfileAvatar, createProfilePhotoPicker, renderAdvisorProfile, playProfileEntrance, clearProfileEntrance });`, {
    document: { createElement: tag => new Element(tag) },
    window: { matchMedia: () => ({ matches: reducedMotion }) },
    advisorIcon: () => '<svg></svg>',
    getLevelProgress: (level = 1, sales = 0) => {
      const currentLevel = Math.min(3, Math.max(1, Number(level) || 1));
      const target = currentLevel === 1 ? 1 : currentLevel === 2 ? 5 : null;
      return { level: currentLevel, sales: Math.max(0, Number(sales) || 0), target, percentage: target ? Math.min(100, Math.round((sales / target) * 100)) : 100 };
    },
    gsap: { context: callback => { callback(); return { revert() { reverted++; } }; }, fromTo: (...args) => calls.push(args) },
  });
  return { ...api, calls, reverted: () => reverted };
}

test('all avatar variants retain the shared class and fall back when a photo fails', () => {
  const { createProfileAvatar } = setup();
  for (const modifier of ['', 'profile-page-avatar', 'profile-dialog-avatar']) {
    const photo = createProfileAvatar({ full_name: 'Asesor 2', avatar_url: '/photo.png' }, modifier);
    assert.ok(photo.className.split(' ').includes('profile-avatar'));
    assert.equal(photo.alt, 'Foto de Asesor 2');
    const host = new Element('div'); host.append(photo);
    photo.events.error();
    assert.equal(host.children[0].tagName, 'SPAN');
    assert.equal(host.children[0].textContent, 'A');
    assert.ok(host.children[0].className.includes(modifier));
  }
  assert.equal(createProfileAvatar({ full_name: '  María', avatar_url: '' }).textContent, 'M');
  assert.equal(createProfileAvatar({ full_name: '' }).textContent, 'A');
});

test('photo picker opens device files directly and cancellation does not upload', () => {
  const { createProfilePhotoPicker } = setup();
  const files = [];
  const picker = createProfilePhotoPicker(file => files.push(file));
  const input = picker.querySelector('input');
  picker.querySelector('button').click();
  assert.equal(input.clicked, true);
  assert.equal(input.accept, 'image/jpeg,image/png,image/webp');
  input.files = []; input.events.change();
  assert.equal(files.length, 0);
  const file = { type: 'image/png' };
  input.files = [file]; input.events.change();
  assert.equal(files[0], file);
  assert.equal(input.value, '');
});

test('profile separates identity, session and deletion while keeping action callbacks', () => {
  const { renderAdvisorProfile } = setup();
  const page = new Element('div');
  const events = [];
  const actions = Object.fromEntries(['upload', 'remove', 'signOut', 'deleteAccount'].map(name => [name, () => events.push(name)]));
  renderAdvisorProfile(page, { full_name: 'Asesor 2', role: 'advisor', avatar_path: 'photo.png' }, actions);
  assert.equal(page.querySelector('h1').textContent, 'Perfil');
  assert.equal(page.querySelectorAll('.profile-section').length, 3);
  const buttons = page.querySelectorAll('button');
  for (const [label, event] of [['Quitar foto', 'remove'], ['Cerrar sesión', 'signOut'], ['Borrar cuenta', 'deleteAccount']]) {
    buttons.find(button => button.textContent === label).click();
    assert.equal(events.at(-1), event);
  }
  const withoutPhoto = new Element('div');
  renderAdvisorProfile(withoutPhoto, { full_name: 'Asesor', role: 'advisor' }, actions, true);
  assert.equal(withoutPhoto.querySelectorAll('button').some(button => button.textContent === 'Quitar foto'), false);
  assert.ok(withoutPhoto.querySelector('.profile-photo-action').disabled);
  assert.equal(withoutPhoto.querySelector('.profile-upload-label').textContent, 'Guardando foto…');
});

test('advisor profile shows stored level, points and sales progression', () => {
  const { renderAdvisorProfile } = setup();
  const page = new Element('div');
  const actions = Object.fromEntries(['upload', 'remove', 'signOut', 'deleteAccount'].map(name => [name, () => {}]));
  renderAdvisorProfile(page, { full_name: 'Asesor 2', role: 'advisor', points: 125, level: 2, progression_sales: 1 }, actions);
  const progression = page.querySelector('.profile-progression');
  assert.ok(progression);
  assert.match(progression.textContent, /Nivel 2/);
  assert.match(progression.textContent, /125 puntos/);
  assert.match(progression.textContent, /1 de 5 ventas/);
});

test('entrance stays under 280ms, plays once per visit and cleans up', () => {
  const api = setup(); const page = new Element('div');
  api.playProfileEntrance(page);
  assert.equal(api.calls.length, 1);
  assert.ok(api.calls[0][2].duration <= .28);
  api.clearProfileEntrance(false);
  assert.equal(api.reverted(), 1);
  api.playProfileEntrance(page);
  assert.equal(api.calls.length, 1);
  api.clearProfileEntrance();
  api.playProfileEntrance(page);
  assert.equal(api.calls.length, 2);
});

test('reduced motion and keyboard navigation leave the profile immediately visible', () => {
  const reduced = setup({ reducedMotion: true });
  reduced.playProfileEntrance(new Element('div'));
  assert.equal(reduced.calls.length, 0);
  const keyboard = setup();
  keyboard.playProfileEntrance(new Element('div'), true);
  assert.equal(keyboard.calls.length, 0);
});

test('ranking shows advisor photos in both views without changing position or metrics', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const fn = source.slice(source.indexOf('// Podio del ranking'), source.indexOf('function intro('));
  const { createProfileAvatar } = setup();
  const rankingSection = runInNewContext(`${fn}; rankingSection;`, {
    ranking: [{ advisor_id: 'a', full_name: 'Ana', position: 1, confirmed_sales: 2, confirmed_tons: 70, avatar_url: '/ana.png' }],
    user: { id: 'a' }, createProfileAvatar,
    getRankingSlots: rows => [...rows, { position: 2, full_name: 'Falta un asesor', placeholder: true }],
    el(tag, cls = '', text = '') { const node = new Element(tag); node.className = cls; node.textContent = text; return node; },
  });
  for (const advisor of [true, false]) {
    const section = rankingSection(advisor);
    const photo = section.querySelector('img');
    assert.equal(photo.src, '/ana.png');
    assert.equal(photo.dataset.advisorId, 'a');
    assert.ok(photo.className.includes('ranking-avatar'));
    assert.equal(section.querySelectorAll('.ranking-avatar').length, 1);
    assert.match(section.textContent, /Ana/);
    assert.match(section.textContent, /70/);
    assert.match(section.textContent, /2/);
  }
});
