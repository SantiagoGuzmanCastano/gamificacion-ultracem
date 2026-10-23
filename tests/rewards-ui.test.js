import test from 'node:test';
import assert from 'node:assert/strict';
import { renderRewards, rewards, showRewardPreview } from '../src/rewards.js';
import { readFileSync } from 'node:fs';

test('rewards decoration overrides the shared mobile hiding rule without changing shop CSS', () => {
  const css = readFileSync(new URL('../src/rewards.css', import.meta.url), 'utf8');
  assert.match(css, /\.rewards-showcase \.halloween-decoration\s*\{[^}]*display: block;/);
});

test('Halloween rewards reuse the shop seasonal backdrop and showcase proportions', () => {
  const css = readFileSync(new URL('../src/rewards.css', import.meta.url), 'utf8');
  assert.match(css, /\.rewards-showcase\s*\{[^}]*grid-template-columns:\s*minmax\(0, 2fr\) minmax\(0, 3fr\)/);
  assert.match(css, /\.rewards-grid-featured\s*\{[^}]*max-width:\s*600px/);
  const shop = readFileSync(new URL('../src/shop.css', import.meta.url), 'utf8');
  assert.match(shop, /\.halloween-backdrop\s*\{[^}]*halloween-light\.webp/);
  assert.match(shop, /:root\[data-theme="dark"\] \.halloween-backdrop\s*\{[^}]*halloween-dark\.webp/);
});

function node() {
  return { children: [], dataset: {}, style: { setProperty() {} }, innerHTML: '',
    append(child) { this.children.push(child); }, replaceChildren() { this.children = []; },
    setAttribute(key, value) { this[key] = value; },
    addEventListener(key, fn) { this[key] = fn; },
    querySelectorAll() { return this.children; } };
}

test('catalog has only two Halloween rewards and five regular rewards', () => {
  assert.deepEqual(rewards.filter(reward => reward.featured).map(reward => reward.id), ['haunted-cinema', 'sweet-treat']);
  assert.equal(rewards.filter(reward => !reward.featured).length, 5);
  assert.equal(new Set(rewards.map(reward => reward.id)).size, 7);
  assert.ok(rewards.every(reward => reward.cost > 0));
  for (const category of ['fun', 'shop', 'money', 'time']) {
    assert.ok(rewards.some(reward => !reward.featured && reward.category === category));
  }
});

test('every reward can open a disposable preview without spending points or sending email', () => {
  const previous = globalThis.document;
  const body = node();
  let current;
  let focused = 0;
  globalThis.document = {
    body, querySelector: () => current,
    createElement: () => {
      const dialog = node();
      const button = node();
      dialog.querySelector = () => button;
      dialog.showModal = () => { dialog.open = true; current = dialog; };
      dialog.close = () => { dialog.open = false; dialog.events.close(); };
      dialog.remove = () => { current = undefined; };
      dialog.events = {};
      dialog.addEventListener = (key, fn) => { dialog.events[key] = fn; };
      return dialog;
    },
  };
  try {
    const catalog = JSON.stringify(rewards);
    for (const reward of rewards) {
      showRewardPreview(reward, { focus: () => focused++ });
      assert.equal(current.open, true);
      assert.match(current.innerHTML, /¡Bono reclamado!/);
      assert.match(current.innerHTML, /¡Te llegó al correo!/);
      assert.ok(current.innerHTML.includes(reward.name));
      assert.match(current.innerHTML, /No enviamos ningún correo/);
      current.querySelector('button').click();
      assert.equal(current, undefined);
    }
    assert.equal(focused, 7);
    assert.equal(JSON.stringify(rewards), catalog);
  } finally { globalThis.document = previous; }
});

test('reward cards show affordability without enabling a transaction and retain filters', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: node };
  try {
    const elements = new Map();
    const page = node();
    page.querySelector = selector => {
      if (!elements.has(selector)) elements.set(selector, node());
      return elements.get(selector);
    };
    renderRewards(page, 100, new Date(2026, 9, 23));
    assert.match(page.innerHTML, /class="rewards-featured halloween-collection"/);
    assert.match(page.innerHTML, /class="halloween-backdrop"/);
    assert.match(page.innerHTML, /class="halloween-content"/);
    assert.match(page.innerHTML, /Exclusivos de Halloween/);
    assert.match(page.innerHTML, /Quedan 06 días 14 h 32 min/);
    for (const filter of page.querySelector('.rewards-filters').children) {
      assert.match(filter.innerHTML, /<svg/);
    }
    const cards = page.querySelector('.rewards-grid-collection').children;
    for (const card of cards) {
      assert.match(card.innerHTML, /rewards-card-frame/);
      assert.match(card.innerHTML, /rewards-photo/);
      assert.doesNotMatch(card.innerHTML, /<img/);
    }
    assert.match(cards[0].innerHTML, /Disponible/);
    assert.doesNotMatch(cards[0].innerHTML, /disabled/);
    assert.match(cards[0].innerHTML, /Simular canje/);
    assert.match(cards[1].innerHTML, /Te faltan 50/);
    assert.match(page.innerHTML, /Vista conceptual/);
    assert.match(page.innerHTML, /halloween-topitin\.png/);
    page.querySelector('.rewards-filters').children[1].click();
    assert.equal(page.querySelector('.rewards-grid-collection').children.length, 2);
    page.querySelector('.rewards-filters').children[0].click();
    renderRewards(page, 0, new Date(2026, 10, 1));
    assert.doesNotMatch(page.innerHTML, /halloween-topitin\.png/);
  } finally { globalThis.document = previous; }
});
