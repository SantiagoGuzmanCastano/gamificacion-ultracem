import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { outfits } from '../src/shop.js';

test('the normal collection includes classic and nine progressively priced outfits', () => {
  assert.deepEqual(outfits.map(outfit => outfit.name), [
    'Pingüino Clásico', 'Pingüino Playero', 'Pingüino Urbano', 'Pingüino Jazzy Dancer',
    'Pingüino Luchador', 'Pingüino Empresario', 'Pingüino Hacker', 'Pingüino Hechicero',
    'Pingüino Fénix', 'Pingüino Absoluto',
  ]);
  assert.deepEqual(outfits.map(outfit => outfit.price), [0, 50, 100, 150, 200, 250, 300, 350, 400, 450]);
  assert.equal(outfits.some(outfit => /zombie|esqueleto|halloween/i.test(outfit.name)), false);
});

test('shop artwork preserves the original supplied PNG bytes', () => {
  const originalHashes = {
    clasico: 'f147a531fa08a072d12ce4a01817530e52febdbc921c93c49fdeb464d13b7057',
    playero: '651fbdfe7d51138265d8d7172c530a31557019abc22477e32d0d1bb33b959ea2',
    urbano: '231252a541b17a4ee6ad8756afa5bef8f228ef1b1205607ee0169e085f63182c',
    'jazzy-dancer': 'a243f0746f87ff250e39e7d0bc01b49a0f1194d9c069b363160bb1cf5cedb2cd',
    luchador: 'b953e2f1c317b086558f9d5f26d8126aa2421171c9ad2572931131d12a9a8661',
    empresario: 'fa68e8b2f6eb096b035a5383a86ae02ecb390720fa3437b7d2e4477592c5b8d0',
    hacker: '11207965d81348d97c36a0ca08efa685a11d5380fce8347b1642e14a74a8a075',
    hechicero: 'd041fcd1d7afc87e58c72f967496b4355b292222c5a1db5b5dcc3cc85e2c9f0b',
    fenix: '72984f83add2f68d22c6788480a5778c3792c0a1f0b50bfe9435ad73fe484690',
    absoluto: '278843b29ca18f538f832c5d5615bf3837b2e7cc52d9b39facd0c05f43ba288d',
  };
  for (const outfit of outfits) {
    const published = readFileSync(new URL(`../public${outfit.image}`, import.meta.url));
    assert.equal(createHash('sha256').update(published).digest('hex'), originalHashes[outfit.id], outfit.name);
  }
});
