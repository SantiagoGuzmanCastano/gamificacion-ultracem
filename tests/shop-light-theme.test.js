import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/shop.css', import.meta.url), 'utf8');
const marker = '/* Light storefront: isolated from dark mode and seasonal cards. */';

test('light storefront overrides are theme-scoped and preserve seasonal cards', () => {
  const light = css.split(marker)[1];
  assert.ok(light, 'dedicated light theme block');
  const selectors = [...light.matchAll(/([^{}]+)\{/g)]
    .map(match => match[1].trim()).filter(selector => !selector.startsWith('@'));
  for (const group of selectors) for (const selector of group.split(',')) {
    assert.ok(selector.trim().startsWith(':root:not([data-theme="dark"]) .shop-page'), selector);
  }
  assert.match(light, /\.shop-card:not\(\.shop-card-halloween\)/);
  assert.doesNotMatch(light, /url\(|animation:|transform:|opacity:\s*0\s*;/);
  assert.match(light, /:focus-visible/);
});

test('light storefront text and action palettes meet normal-text contrast', () => {
  assert.ok(css.includes(marker));
  const luminance = hex => {
    const rgb = hex.match(/[a-f\d]{2}/gi).map(channel => parseInt(channel, 16) / 255)
      .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  for (const [ink, surface] of [['14233b', 'f5f9fd'], ['3f5872', 'ffffff'], ['063b67', 'eaf4fc'], ['ffffff', '063b67'], ['354f68', 'edf2f6'], ['164e78', 'd4edfc'], ['165a35', 'def4e6']]) {
    const light = css.split(marker)[1].replaceAll('#fff;', '#ffffff;');
    assert.ok(light.includes(`#${ink}`), `foreground ${ink} must exist in light rules`);
    assert.ok(light.includes(`#${surface}`), `surface ${surface} must exist in light rules`);
    const levels = [luminance(ink), luminance(surface)].sort((a, b) => b - a);
    assert.ok((levels[0] + .05) / (levels[1] + .05) >= 4.5, `${ink} on ${surface}`);
  }
});
