import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { halloweenOutfits, outfits, renderShop } from '../src/shop.js';

test('skeleton requires two confirmed sales and displays the same requirement', () => {
  const previousDocument = globalThis.document;
  const node = () => ({ children: [], append(child) { this.children.push(child); }, setAttribute() {}, querySelector() { return { addEventListener() {} }; } });
  globalThis.document = { createElement: node };
  try {
    for (const sales of [0, 1, 2]) {
      const normal = node(), halloween = node();
      globalThis.document.createElement = tag => tag === 'section' ? { ...node(), querySelector: () => halloween } : node();
      const page = { querySelector(selector) {
        if (selector === '.shop-grid') return normal;
        if (selector === '#halloween-collection') return null;
        return { before() {} };
      } };
      renderShop(page, sales, true);
      const skeleton = halloween.children.find(card => card.className.includes('shop-card-esqueleto'));
      assert.match(skeleton.innerHTML, /<strong>2 ventas<\/strong>/);
      assert.match(skeleton.innerHTML, sales < 2 ? /disabled>Bloqueado · 2 ventas/ : />Equipar<\/button>/);
    }
  } finally { globalThis.document = previousDocument; }
});

test('Halloween adds only the supplied exclusive outfits and preserves the normal catalog', () => {
  assert.deepEqual(halloweenOutfits.map(outfit => [outfit.id, outfit.name]), [
    ['zombie', 'Pingüino Zombie'], ['esqueleto', 'Pingüino Esqueleto'],
  ]);
  assert.equal(outfits.length, 10);
  assert.deepEqual(outfits.map(outfit => outfit.price), [0, 50, 100, 150, 200, 250, 300, 350, 400, 450]);
});

test('Halloween artwork preserves the supplied PNG bytes', () => {
  const expected = {
    zombie: 'ef49d94ebf61e057172fc19d552178b9dffcbae243ec207bd81defa34a6aae01',
    esqueleto: '857067648287846fe2c263f17adfdfc9bc2c92eab1b023041e33be632d45f81d',
  };
  for (const outfit of halloweenOutfits) {
    const bytes = readFileSync(new URL(`../public${outfit.image}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected[outfit.id]);
  }
});
