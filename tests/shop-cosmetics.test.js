import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as shop from '../src/shop.js';

test('shop navigation is named Tienda cosméticos for advisors and hidden for admins', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes("['shop', 'Tienda cosméticos', 'shop']"));
  assert.ok(main.includes("[['dashboard', 'Resumen', 'home'], ['team', 'Asesores', 'clients'], ['zones', 'Zonas', 'target'], ['map', 'Mapa de ventas', 'map'], ['manage', 'Gestión', 'tasks']]"));
  assert.equal(main.includes("['shop', 'Tienda',"), false);
});

test('conceptual catalogs contain Colombian themes and sample point prices with avatars cheapest', () => {
  assert.equal(shop.chests?.length, 5);
  assert.equal(shop.avatars?.length, 5);
  assert.deepEqual(shop.avatars.map(item => item.name), ['Café colombiano', 'Carnaval de Barranquilla', 'Orgullo Tricolor', 'Medellín, Ciudad de la Eterna Primavera', 'Herencia Zenú']);
  assert.deepEqual(shop.chests.map(item => item.name), ['Cofre Tricolor', 'Cofre Aguamarina', 'Cofre El Dorado', 'Cofre Leyenda Muisca', 'Cofre Esmeralda Colombiana']);
  assert.deepEqual(shop.chests.map(item => item.rarity), ['Común', 'Raro', 'Súper Raro', 'Épico', 'Mítico']);
  assert.ok(Math.max(...shop.avatars.map(item => item.price)) < Math.min(...shop.chests.map(item => item.price)));
  assert.ok(Math.max(...shop.avatars.map(item => item.price)) < 50);
  for (const catalog of [shop.chests, shop.avatars]) {
    assert.equal(new Set(catalog.map(item => item.id)).size, 5);
    for (const item of catalog) {
      assert.ok(item.price > 0);
      assert.ok(item.description.length > 20);
      assert.equal(item.currency, 'points');
    }
  }
});

test('every conceptual cosmetic has a public PNG illustration and card background', () => {
  assert.ok(shop.chests && shop.avatars, 'catalogs must be exported');
  for (const item of [...shop.chests, ...shop.avatars]) {
    for (const path of [item.image, item.background]) {
      assert.match(path, /^\/shop\/(chests|avatars)\/[a-z0-9/-]+\.png$/);
      const bytes = readFileSync(new URL(`../public${path}`, import.meta.url));
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    }
  }
});

test('conceptual cosmetics reuse existing decorative frames', () => {
  for (const item of [...shop.chests, ...shop.avatars]) {
    assert.match(item.frame || '', /^\/shop\/frames\/skins\/[a-z-]+-frame\.png$/);
    const bytes = readFileSync(new URL(`../public${item.frame}`, import.meta.url));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
});

test('shop frame thickness and background transparency are isolated from foreground content', () => {
  const css = readFileSync(new URL('../src/shop.css', import.meta.url), 'utf8');
  assert.match(css, /\.shop-page \.shop-card-frame\s*\{[^}]*border-width:\s*11\.5px;[^}]*border-image-width:\s*11\.5px;/);
  assert.match(css, /\.shop-page \.shop-artwork::before\s*\{[^}]*background:[^}]*var\(--skin-bg\)[^}]*opacity:\s*\.264;/);
});

test('all shop cards have a branded hover glow restricted to precise hover pointers', () => {
  const css = readFileSync(new URL('../src/shop.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)\s*\{\s*\.shop-page \.shop-card:hover\s*\{[^}]*box-shadow:[^}]*rgb\(255 201 40 \/ 32%\)/);
});
