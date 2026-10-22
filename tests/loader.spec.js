// @vitest-environment jsdom
// Spec del loader con el logo de Ultracem (fase Red). Se muestra mientras cargan los datos.
import { beforeEach, describe, expect, it } from 'vitest';
import { createLoader } from '../src/loader.js';

describe('createLoader', () => {
  let loader;

  beforeEach(() => {
    document.body.innerHTML = '';
    loader = createLoader(document.body);
  });

  it('se muestra como estado accesible "Cargando Ultracem"', () => {
    const node = document.querySelector('[data-testid="loader"]');
    expect(node).toBe(loader.element);
    expect(node.getAttribute('role')).toBe('status');
    expect(node.getAttribute('aria-live')).toBe('polite');
    expect(node.getAttribute('aria-label')).toBe('Cargando Ultracem');
  });

  it('lleva el logo oficial de la marca, no el anillo dibujado con CSS', () => {
    const logo = loader.element.querySelector('[data-testid="loader-logo"]');
    expect(logo.tagName).toBe('IMG');
    expect(logo.getAttribute('src')).toBe('/ultracem-logo.png');
    expect(logo.getAttribute('alt')).toBe('Ultracem');
    expect(loader.element.querySelector('.loader-ring')).toBeNull();
  });

  it('no crea un segundo loader si ya hay uno en pantalla', () => {
    const again = createLoader(document.body);
    expect(again.element).toBe(loader.element);
    expect(document.querySelectorAll('[data-testid="loader"]')).toHaveLength(1);
  });

  it('hide sin animación lo quita del DOM y resuelve', async () => {
    await loader.hide({ animate: false });
    expect(document.querySelector('[data-testid="loader"]')).toBeNull();
  });

  it('hide es seguro si se llama dos veces', async () => {
    await loader.hide({ animate: false });
    await expect(loader.hide({ animate: false })).resolves.toBeUndefined();
  });
});
