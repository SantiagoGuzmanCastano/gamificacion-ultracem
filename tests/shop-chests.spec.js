// @vitest-environment jsdom
// Spec de los cofres de la tienda (fase Red). Solo visual: se muestran debajo de las skins,
// con precio en ventas confirmadas y botón "Próximamente". Precios y contenidos = Muestra.
import { beforeEach, describe, expect, it } from 'vitest';
import { chests, renderShop } from '../src/shop.js';

describe('catálogo de cofres', () => {
  it('tiene tres niveles: Bronce, Plata y Oro, con precio creciente en ventas', () => {
    expect(chests.map(chest => chest.id)).toEqual(['bronce', 'plata', 'oro']);
    expect(chests.map(chest => chest.name)).toEqual(['Cofre de Bronce', 'Cofre de Plata', 'Cofre de Oro']);
    expect(chests.map(chest => chest.price)).toEqual([5, 15, 30]);
  });

  it('usa los SVG arcade de public/shop/chests/', () => {
    expect(chests.map(chest => chest.image)).toEqual([
      '/shop/chests/bronce.svg', '/shop/chests/plata.svg', '/shop/chests/oro.svg',
    ]);
  });
});

describe('sección de cofres en la tienda', () => {
  let page;

  beforeEach(() => {
    document.body.innerHTML = '<main></main>';
    page = document.querySelector('main');
    renderShop(page, 3);
  });

  it('aparece debajo de la colección de skins y antes de la nota final', () => {
    const section = page.querySelector('#chest-collection');
    expect(section).not.toBeNull();
    expect(section.getAttribute('aria-labelledby')).toBe('chest-title');
    expect(section.querySelector('#chest-title').textContent).toBe('Cofres');
    expect(section.previousElementSibling.querySelector('#collection-title')).not.toBeNull();
    expect(section.nextElementSibling.classList.contains('shop-note')).toBe(true);
  });

  it('muestra una tarjeta por cofre con imagen, nombre y precio', () => {
    const cards = [...page.querySelectorAll('#chest-collection .chest-card')];
    expect(cards).toHaveLength(3);
    const [bronce] = cards;
    const image = bronce.querySelector('img');
    expect(image.getAttribute('src')).toBe('/shop/chests/bronce.svg');
    expect(image.getAttribute('alt')).toBe('Cofre de Bronce');
    expect(bronce.querySelector('h3').textContent).toBe('Cofre de Bronce');
    const price = bronce.querySelector('.chest-price');
    expect(price.querySelector('[aria-hidden="true"]').textContent).toBe('x5');
    expect(price.querySelector('.sr-only').textContent).toBe('5 ventas para desbloquear');
  });

  it('el botón dice "Próximamente" y está desactivado aunque alcancen las ventas', () => {
    const buttons = page.querySelectorAll('#chest-collection .chest-card button');
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.textContent.trim()).toBe('Próximamente');
      expect(button.disabled).toBe(true);
    }
  });

  it('sigue debajo de las skins con el modo Halloween activo', () => {
    renderShop(page, 3, true);
    const sections = [...page.querySelectorAll('section')].map(section => section.id || section.className);
    expect(sections.indexOf('chest-collection')).toBe(sections.length - 1);
    expect(page.querySelector('#halloween-collection')).not.toBeNull();
  });
});
