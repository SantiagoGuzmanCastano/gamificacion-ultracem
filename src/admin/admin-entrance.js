import { gsap } from 'gsap';

// Una vez por visita a cada vista: los refrescos de datos no repiten la entrada.
let lastView = null;

export function resetAdminEntrance() {
  lastView = null;
}

// Entrada sobria del admin: el título y luego cada bloque suben un poco y aparecen, en cascada corta.
export function playAdminEntrance(page, view) {
  if (view === lastView) return;
  lastView = view;
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true) return;
  const blocks = [...page.children].flatMap(child => child.matches('.admin-answers, .admin-tops, .manage-layout') ? [...child.children] : [child]);
  gsap.from(blocks, { opacity: 0, y: 12, duration: .45, stagger: .06, ease: 'power2.out', clearProps: 'transform,opacity' });
  const fills = page.querySelectorAll('.admin-progress-fill, .admin-bar-fill');
  if (fills.length) gsap.from(fills, { scaleX: 0, transformOrigin: '0 50%', duration: .7, stagger: .03, ease: 'power3.out', delay: .2, clearProps: 'transform' });
}
