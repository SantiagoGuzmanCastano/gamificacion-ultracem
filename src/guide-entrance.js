import { gsap } from 'gsap';

// Entrada ligera de «¿Cómo funciona esta pantalla?»: el botón aparece subiendo un poco y Topitín
// se asoma con un rebote. Una vez por visita a cada pantalla; los refrescos no la repiten.
let lastScreen = '';

export function playGuideEntrance(page, screen) {
  if (screen === lastScreen) return;
  lastScreen = screen;
  const buttons = page.querySelectorAll('.advisor-guide-button, .progress-replay-small');
  if (!buttons.length || (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true)) return;
  gsap.timeline({ delay: .35, defaults: { ease: 'power2.out' } })
    .fromTo(buttons, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .4, stagger: .08, clearProps: 'transform,opacity' })
    .fromTo(page.querySelectorAll('.advisor-guide-button .advisor-guide-mascot'), { scale: .5, rotation: -25 }, { scale: 1, rotation: 0, duration: .55, ease: 'back.out(2.4)', clearProps: 'transform' }, .1);
}

export function resetGuideEntrance() {
  lastScreen = '';
}
