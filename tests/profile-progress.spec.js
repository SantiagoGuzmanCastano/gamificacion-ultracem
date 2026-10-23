// @vitest-environment jsdom
// Spec del perfil con progreso (fase Red): progreso, Topitín con su skin y logros con datos reales.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProfileAchievements, renderAdvisorProfile } from '../src/profile-view.js';

const profile = { user_id: 'u1', full_name: 'Asesor Demo', role: 'advisor', avatar_path: null };
const progress = { sales: 1, tons: 15, streak: 2, position: 2, skinImage: '/mascot/feliz.png' };
const actions = () => ({ upload() {}, remove() {}, signOut() {}, deleteAccount() {}, openShop: vi.fn() });

describe('logros del perfil', () => {
  it('se calculan con ventas, racha y toneladas reales', () => {
    expect(getProfileAchievements({ sales: 0, tons: 0, streak: 0 }).map(item => [item.id, item.name, item.unlocked])).toEqual([
      ['first-sale', 'Primera venta', false],
      ['streak-3', 'Racha de 3 días', false],
      ['tons-50', '50 t vendidas', false],
    ]);
    expect(getProfileAchievements({ sales: 1, tons: 50, streak: 3 }).every(item => item.unlocked)).toBe(true);
    expect(getProfileAchievements({ sales: 1, tons: 49, streak: 2 }).map(item => item.unlocked)).toEqual([true, false, false]);
  });
});

describe('perfil del asesor', () => {
  let page, handlers;

  beforeEach(() => {
    document.body.innerHTML = '<main></main>';
    page = document.querySelector('main');
    handlers = actions();
    renderAdvisorProfile(page, profile, handlers, false, progress);
  });

  it('muestra "Tu progreso" con ventas, toneladas, racha y posición', () => {
    const section = page.querySelector('.profile-progress');
    expect(section.querySelector('h2').textContent).toBe('Tu progreso');
    const stats = [...section.querySelectorAll('.profile-stat')].map(stat => [stat.querySelector('span').textContent, stat.querySelector('strong').textContent]);
    expect(stats).toEqual([
      ['Ventas confirmadas', '1'], ['Toneladas vendidas', '15 t'], ['Racha actual', '2 días'], ['Posición', '#2'],
    ]);
  });

  it('sin posición en el ranking muestra un guion', () => {
    page.replaceChildren();
    renderAdvisorProfile(page, profile, handlers, false, { ...progress, position: null });
    expect(page.querySelector('.profile-stat:last-child strong').textContent).toBe('—');
  });

  it('muestra a Topitín con la skin equipada y lleva a la Tienda', () => {
    const skin = page.querySelector('.profile-skin img');
    expect(skin.getAttribute('src')).toBe('/mascot/feliz.png');
    expect(skin.getAttribute('alt')).toBe('Topitín con tu skin equipada');
    const go = [...page.querySelectorAll('.profile-skin button')].find(button => button.textContent === 'Cambiar en la Tienda');
    go.click();
    expect(handlers.openShop).toHaveBeenCalledOnce();
  });

  it('cada logro dice con texto si está conseguido o bloqueado (no solo color)', () => {
    const badges = [...page.querySelectorAll('.profile-achievement')];
    expect(badges.map(badge => badge.dataset.unlocked)).toEqual(['true', 'false', 'false']);
    expect(badges[0].textContent).toContain('Primera venta');
    expect(badges[0].textContent).toContain('Conseguido');
    expect(badges[1].textContent).toContain('Bloqueado');
  });

  it('el progreso va después de la identidad y "Eliminar cuenta" queda al final', () => {
    const sections = [...page.children];
    expect(sections.indexOf(page.querySelector('.profile-progress'))).toBe(sections.indexOf(page.querySelector('.profile-identity')) + 1);
    expect(sections.at(-1).classList.contains('profile-danger')).toBe(true);
  });

  it('el administrador no ve progreso de asesor', () => {
    page.replaceChildren();
    renderAdvisorProfile(page, { ...profile, role: 'admin' }, handlers, false, progress);
    expect(page.querySelector('.profile-progress')).toBeNull();
  });
});
