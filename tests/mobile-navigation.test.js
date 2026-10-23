import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('mobile advisor navigation uses compact names but retains full accessible labels and routes', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /container === mobileNav \? mobileLabels\[view\] : label/);
  assert.match(main, /control\.setAttribute\('aria-label', label\)/);
  for (const label of ['Inicio', 'Clientes', 'Comisiones', 'Mapa', 'Cosméticos', 'Premios', 'Perfil']) assert.ok(main.includes(`'${label}'`));
  assert.ok(main.includes('event => navigate(view, event)'));
});

test('mobile navigation is an even compact grid and Halloween cards are horizontally centered', () => {
  const advisor = readFileSync(new URL('../src/advisor.css', import.meta.url), 'utf8');
  assert.match(advisor, /\.advisor-shell \.advisor-nav\s*\{[^}]*display: grid;[^}]*grid-template-columns: repeat\(8, minmax\(0, 1fr\)\)/);
  assert.match(advisor, /\.advisor-nav button:nth-child\(5\)\s*\{\s*grid-column: 2 \/ span 2;/);
  const shop = readFileSync(new URL('../src/shop.css', import.meta.url), 'utf8');
  assert.match(shop, /\.halloween-showcase > \.shop-grid\s*\{[^}]*max-width: 360px;[^}]*margin-inline: auto;/);
});
