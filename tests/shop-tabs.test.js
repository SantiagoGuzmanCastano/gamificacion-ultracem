import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderShop, renderHalloweenCollection } from '../src/shop.js';

class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.attrs = {}; this.events = {}; this.hidden = false; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  getAttribute(key) { return this.attrs[key]; }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  before(child) { child.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this), 0, child); }
  remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); }
  addEventListener(type, handler) { this.events[type] = handler; }
  focus() { this.focused = true; }
  click() { this.events.click?.({}); }
  set innerHTML(html) {
    this.html = html; this.children = [];
    const stack = [this];
    for (const match of html.matchAll(/<\/?([a-z][\w-]*)\b([^>]*?)>/gi)) {
      const [token, tag, attributes] = match;
      if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      const node = new Element(tag);
      for (const attr of attributes.matchAll(/([\w-]+)(?:="([^"]*)"|'([^']*)')?/g)) node.attrs[attr[1]] = attr[2] ?? attr[3] ?? '';
      node.id = node.attrs.id; node.className = node.attrs.class || ''; node.hidden = 'hidden' in node.attrs;
      stack.at(-1).append(node);
      if (!['img', 'input', 'br'].includes(tag)) stack.push(node);
    }
  }
  get innerHTML() { return this.html; }
  querySelectorAll(selector) {
    const matches = node => selector.startsWith('#') ? node.id === selector.slice(1)
      : selector.startsWith('.') ? node.className?.split(' ').includes(selector.slice(1))
      : selector.startsWith('[role=') ? node.attrs.role === selector.match(/"(.*?)"/)[1] : node.tag === selector;
    return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function setup(run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: tag => new Element(tag) };
  try { run(new Element()); } finally { globalThis.document = previous; }
}

test('shop tabs expose linked panels and show only the selected collection', () => setup(page => {
  renderShop(page, 2, true);
  const tabs = page.querySelectorAll('[role="tab"]');
  const panels = page.querySelectorAll('[role="tabpanel"]');
  assert.equal(tabs.length, 3);
  assert.equal(panels.length, 3);
  for (let i = 0; i < tabs.length; i++) {
    tabs[i].click();
    assert.deepEqual(panels.map(panel => panel.hidden), panels.map((_, index) => index !== i));
    assert.deepEqual(tabs.map(tab => tab.getAttribute('aria-selected')), tabs.map((_, index) => String(index === i)));
    assert.equal(tabs[i].getAttribute('aria-controls'), panels[i].id);
    assert.equal(panels[i].getAttribute('aria-labelledby'), tabs[i].id);
    assert.equal(panels[i].querySelectorAll('.shop-card').length, i === 0 ? 12 : 5);
    if (i > 0) assert.equal(panels[i].querySelectorAll('.shop-card-action').length, 5);
  }
}));

test('arrow keys wrap, Home/End select and only the active tab is in the tab order', () => setup(page => {
  renderShop(page, 0);
  const tabs = page.querySelectorAll('[role="tab"]');
  assert.equal(tabs.length, 3);
  for (const [from, key, to] of [[0, 'ArrowLeft', 2], [2, 'ArrowRight', 0], [0, 'End', 2], [2, 'Home', 0]]) {
    let prevented = false;
    tabs[from].events.keydown({ key, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(tabs[to].focused, true);
    assert.deepEqual(tabs.map(tab => tab.tabIndex), tabs.map((_, i) => i === to ? 0 : -1));
  }
}));

test('Halloween refresh stays inside the outfit panel and existing equip callbacks work', () => setup(page => {
  const equipped = [];
  renderShop(page, 2, false, 'skeleton', skin => equipped.push(skin));
  page.querySelector('.shop-card-clasico').querySelector('.shop-card-action').click();
  assert.deepEqual(equipped, ['classic']);
  const tabs = page.querySelectorAll('[role="tab"]');
  assert.equal(tabs.length, 3);
  tabs[1].click();
  renderHalloweenCollection(page, true, 'classic', 2, skin => equipped.push(skin));
  const panel = page.querySelectorAll('[role="tabpanel"]')[0];
  assert.equal(panel.hidden, true);
  assert.ok(panel.querySelector('#halloween-collection'));
  page.querySelector('.shop-card-esqueleto').querySelector('.shop-card-action').click();
  assert.deepEqual(equipped, ['classic', 'skeleton']);
  renderHalloweenCollection(page, false);
  assert.equal(panel.querySelector('#halloween-collection'), null);
}));

test('cards expose honest equipped, available, locked and upcoming states', () => setup(page => {
  renderShop(page, 1, true, 'classic');
  assert.equal(page.querySelector('.shop-card-clasico').querySelector('.shop-card-action').getAttribute('aria-pressed'), 'true');
  assert.equal(page.querySelector('.shop-card-esqueleto').querySelector('.shop-card-action').getAttribute('disabled'), '');
  assert.equal(page.querySelector('.shop-card-playero').querySelectorAll('.shop-card-state').length, 0);
  renderShop(page, 2, true, 'classic');
  assert.equal(page.querySelector('.shop-card-esqueleto').querySelector('.shop-card-action').getAttribute('disabled'), undefined);
}));

test('shop displays sample point costs and a real point balance without changing legacy equip rules', () => setup(page => {
  renderShop(page, 0, true, 'classic', () => {}, 275);
  assert.match(page.innerHTML, /<h1[^>]*>Tienda de cosméticos<\/h1>/);
  assert.match(page.innerHTML, /275/);
  assert.doesNotMatch(page.innerHTML, /Ventas confirmadas|Próximamente|Precio por definir/);
  assert.match(page.querySelector('.shop-card-esqueleto').innerHTML, /100 puntos/);
  for (const card of page.querySelectorAll('.shop-card')) assert.doesNotMatch(card.innerHTML || '', /ventas|Próximamente/);
}));

test('conceptual cards share outfit point buttons without enabling purchases', () => setup(page => {
  renderShop(page, 0);
  const panels = page.querySelectorAll('[role="tabpanel"]');
  for (const panel of panels.slice(1)) {
    const cards = panel.querySelectorAll('.shop-card');
    assert.equal(cards.length, 5);
    assert.equal(panel.querySelectorAll('.shop-card-category').length, 0);
    assert.equal(panel.querySelectorAll('.shop-card-state').length, 0);
    assert.equal(panel.querySelectorAll('.shop-card-preview').length, 0);
    assert.equal(panel.querySelectorAll('.shop-card-frame').length, 5);
    assert.equal(panel.querySelectorAll('.shop-card-action').length, 5);
    for (const button of panel.querySelectorAll('.shop-card-action')) {
      assert.equal(button.getAttribute('disabled'), '');
      assert.equal(button.events.click, undefined);
    }
  }
}));

test('all card prices omit preview copy and use a hand cursor', () => setup(page => {
  renderShop(page, 0, true);
  assert.doesNotMatch(page.innerHTML, /Precio de muestra|Vista previa de colección/);
  for (const card of page.querySelectorAll('.shop-card')) assert.doesNotMatch(card.innerHTML || '', /Precio de muestra|Vista previa de colección/);
  const css = readFileSync(new URL('../src/shop.css', import.meta.url), 'utf8');
  assert.match(css, /\.shop-page \.shop-card-action\s*\{[^}]*cursor:\s*pointer;/);
}));

test('cards omit redundant labels, descriptions and title emojis while retaining equipped state', () => setup(page => {
  renderShop(page, 0, true);
  assert.equal(page.querySelectorAll('.shop-card-category').length, 0);
  for (const heading of page.querySelectorAll('h3')) assert.equal(heading.querySelectorAll('span').length, 0);
  assert.equal(page.querySelectorAll('.shop-card-description').length, 0);
  assert.equal(page.querySelector('.shop-card-clasico').querySelector('.shop-card-action').getAttribute('aria-pressed'), 'true');
}));

test('reference-inspired header and tabs use decorative icons and retain the point balance', () => setup(page => {
  renderShop(page, 0, false, 'classic', () => {}, 275);
  const tabs = page.querySelectorAll('[role="tab"]');
  for (const tab of tabs) {
    assert.equal(tab.querySelectorAll('svg').length, 1);
    assert.equal(tab.querySelector('svg').getAttribute('aria-hidden'), 'true');
  }
  assert.ok(page.querySelector('.shop-heading-copy'));
  assert.ok(page.querySelector('.shop-balance-note'));
  assert.match(page.innerHTML, /275/);
  assert.doesNotMatch(page.innerHTML, /Ventas confirmadas|role="progressbar"/);
}));

test('cards omit repeated chest reward explanations', () => setup(page => {
  renderShop(page, 0);
  const chests = page.querySelector('#shop-panel-chests');
  const avatars = page.querySelector('#shop-panel-avatars');
  assert.equal(chests.querySelectorAll('.shop-chest-note').length, 0);
  assert.equal(avatars.querySelectorAll('.shop-chest-note').length, 0);
  assert.equal((page.innerHTML.match(/<\/button><p class="shop-chest-note">Sirve para desbloquear atuendos o avatares\.<\/p>/g) || []).length, 0);
}));

test('chest and avatar panels omit redundant collection headings and introductions', () => setup(page => {
  renderShop(page, 0);
  for (const id of ['chests', 'avatars']) {
    const panel = page.querySelector(`#shop-panel-${id}`);
    assert.equal(panel.querySelectorAll('h2').length, 0);
    assert.equal(panel.getAttribute('aria-labelledby'), `shop-tab-${id}`);
    assert.equal(panel.querySelectorAll('.shop-count').length, 0);
    assert.equal(panel.querySelectorAll('.shop-collection-heading').length, 0);
    assert.equal(panel.querySelectorAll('.shop-card-description').length, 0);
  }
  assert.doesNotMatch(page.innerHTML, /Tesoros inspirados en las riquezas de Colombia|Tu identidad, con el encanto de nuestra tierra/);
}));

test('cards contain only artwork, name and a single-line action with equipped green styling', () => setup(page => {
  renderShop(page, 0, true);
  for (const card of page.querySelectorAll('.shop-card')) {
    assert.equal(card.querySelectorAll('h3').length, 1);
    assert.equal(card.querySelectorAll('.shop-card-action').length, 1);
    assert.equal(card.querySelectorAll('.shop-try').length, 1);
    assert.equal(card.querySelectorAll('p').length, 0);
    assert.equal(card.querySelectorAll('small').length, 0);
    assert.equal(card.querySelectorAll('.shop-card-state').length, 0);
  }
  assert.match(page.querySelector('.shop-card-playero').innerHTML, /<span class="shop-action-copy">50 puntos<\/span>/);
  assert.match(page.querySelector('.shop-card-clasico').innerHTML, /<span class="shop-action-copy">Equipado<\/span>/);
  const css = readFileSync(new URL('../src/shop.css', import.meta.url), 'utf8');
  assert.match(css, /:root \.shop-page \.shop-card \.shop-card-action-equipped\s*\{[^}]*background:\s*#def4e6;/);
  assert.match(css, /:root\[data-theme="dark"\] \.shop-page \.shop-card \.shop-card-action-equipped\s*\{[^}]*background:\s*#183f2d;/);
}));

test('Halloween illustration is decorative and separate from its two product cards', () => setup(page => {
  renderShop(page, 0, true);
  const section = page.querySelector('#halloween-collection');
  const art = section.querySelector('.halloween-mascot');
  assert.ok(art);
  assert.equal(art.getAttribute('alt'), '');
  assert.equal(art.getAttribute('aria-hidden'), 'true');
  assert.equal(art.parent.className, 'halloween-decoration');
  assert.equal(art.parent.getAttribute('aria-hidden'), 'true');
  assert.equal(section.querySelectorAll('.shop-card').length, 2);
  assert.equal(section.querySelector('.shop-grid').querySelectorAll('.halloween-mascot').length, 0);
  const css = readFileSync(new URL('../src/shop.css', import.meta.url), 'utf8');
  assert.match(css, /\.halloween-mascot\s*\{[^}]*opacity:\s*1;/);
  assert.doesNotMatch(css, /\.halloween-decoration::after/);
}));

test('affordable cosmetics indicate availability at their exact point cost without enabling purchases', () => setup(page => {
  for (const [points, available] of [[9, 0], [10, 1], [30, 5], [150, 6]]) {
    const calls = [];
    renderShop(page, 0, true, 'classic', skin => calls.push(skin), points);
    const panels = page.querySelectorAll('[role="tabpanel"]');
    assert.equal(panels.slice(1).flatMap(panel => panel.querySelectorAll('.shop-card-action-available')).length, available);
    for (const panel of panels.slice(1)) for (const button of panel.querySelectorAll('button')) button.click();
    assert.deepEqual(calls, []);
  }
  renderShop(page, 0, false, 'classic', () => {}, 49);
  assert.equal(page.querySelector('.shop-card-playero').querySelectorAll('.shop-card-action-available').length, 0);
  renderShop(page, 0, false, 'classic', () => {}, 50);
  assert.match(page.querySelector('.shop-card-playero').innerHTML, /Disponible · 50 puntos/);
}));

test('Halloween refresh receives points but only existing equipment callbacks remain functional', () => setup(page => {
  const calls = [];
  renderShop(page, 2, false, 'classic', skin => calls.push(skin), 100);
  renderHalloweenCollection(page, true, 'classic', 2, skin => calls.push(skin), 100);
  page.querySelector('.shop-card-esqueleto').querySelector('.shop-card-action').click();
  assert.deepEqual(calls, ['skeleton']);
  renderHalloweenCollection(page, false);
  renderHalloweenCollection(page, true, 'classic', 0, skin => calls.push(skin), 300);
  assert.match(page.querySelector('.shop-card-zombie').innerHTML, /Disponible · 300 puntos/);
  page.querySelector('.shop-card-zombie').querySelector('.shop-card-action').click();
  assert.deepEqual(calls, ['skeleton']);
}));

test('try-on buttons only preview items in the stage and start with the equipped outfit', () => setup(page => {
  renderShop(page, 0, false, 'classic', () => { throw new Error('try-on must not equip'); }, 500);
  assert.match(page.innerHTML, /<figure class="shop-stage"/);
  assert.match(page.innerHTML, /<figcaption class="shop-stage-caption" aria-live="polite"><span>Llevas puesto<\/span><strong>Pingüino Clásico<\/strong>/);
  const tries = page.querySelectorAll('.shop-try');
  assert.equal(tries.length, 20);
  for (const control of tries) {
    assert.equal(control.getAttribute('aria-pressed'), 'false');
    assert.match(control.getAttribute('aria-label'), /^Probar .+ en el probador$/);
    assert.match(control.getAttribute('data-stage-art'), /\.webp$/);
  }
}));
