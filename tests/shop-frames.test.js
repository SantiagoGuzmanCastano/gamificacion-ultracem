import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { outfits, halloweenOutfits } from '../src/shop.js';

test('every skin has its own transparent, nine-slice-safe frame', () => {
  const skins = [...outfits, ...halloweenOutfits];
  assert.equal(skins.length, 12);
  assert.equal(new Set(skins.map(skin => skin.frame)).size, skins.length);

  for (const skin of skins) {
    assert.equal(skin.frame, `/shop/frames/skins/${skin.id}-frame.png`);
    const png = readFileSync(new URL(`../public${skin.frame}`, import.meta.url));
    assert.equal(png.toString('ascii', 1, 4), 'PNG', skin.id);
    assert.equal(png.readUInt32BE(16), 640, skin.id);
    assert.equal(png.readUInt32BE(20), 800, skin.id);
    assert.equal(png[25], 6, `${skin.id} must use RGBA`);

    const chunks = [];
    for (let offset = 8; offset < png.length;) {
      const length = png.readUInt32BE(offset);
      const type = png.toString('ascii', offset + 4, offset + 8);
      if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
      offset += length + 12;
    }
    const raw = inflateSync(Buffer.concat(chunks));
    const stride = 640 * 4;
    let previous = Buffer.alloc(stride);
    let source = 0;
    for (let y = 0; y < 800; y++) {
      const filter = raw[source++];
      const row = Buffer.from(raw.subarray(source, source + stride));
      source += stride;
      for (let i = 0; i < stride; i++) {
        const left = i >= 4 ? row[i - 4] : 0;
        const up = previous[i];
        const upperLeft = i >= 4 ? previous[i - 4] : 0;
        const predictor = left + up - upperLeft;
        const distances = [Math.abs(predictor - left), Math.abs(predictor - up), Math.abs(predictor - upperLeft)];
        const paeth = distances.indexOf(Math.min(...distances)) === 0 ? left : distances.indexOf(Math.min(...distances)) === 1 ? up : upperLeft;
        const delta = [0, left, up, (left + up) >> 1, paeth][filter];
        assert.notEqual(delta, undefined, `${skin.id} PNG filter`);
        row[i] = (row[i] + delta) & 255;
      }
      if (y >= 48 && y < 752) {
        for (let x = 48; x < 592; x++) assert.equal(row[x * 4 + 3], 0, `${skin.id} obscures the card interior`);
      }
      if (y === 400) {
        assert.equal(row[3], 0, `${skin.id} needs a transparent exterior`);
        assert.ok(row[10 * 4 + 3] > 0, `${skin.id} needs a visible perimeter`);
      }
      previous = row;
    }
  }
});
