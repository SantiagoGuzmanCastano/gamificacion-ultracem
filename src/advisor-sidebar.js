import { gsap } from 'gsap';

// La barra lateral se vuelve a dibujar en cada render; aquí se recuerda dónde estaba
// el indicador para deslizarlo hasta la nueva opción en lugar de saltar.
let introPlayed = false;
let motion = null;
// Posición visible del indicador; sobrevive a los renders para que un segundo render
// seguido (p. ej. al refrescar datos tras navegar) no corte el deslizamiento.
let visual = null;
let slide = null;

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

export function resetSidebarMotion() {
  motion?.revert();
  motion = null;
  slide?.kill();
  slide = null;
  introPlayed = false;
  visual = null;
}

export function animateSidebar(sidebar) {
  motion?.revert();
  motion = null;
  const nav = sidebar.querySelector('.sidebar-nav');
  const active = nav?.querySelector('.sidebar-item.active');
  const indicator = document.createElement('span');
  indicator.className = 'sidebar-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  nav?.prepend(indicator);
  const spot = active ? { y: active.offsetTop, height: active.offsetHeight } : null;
  const paint = () => gsap.set(indicator, { y: visual.y, height: visual.height });
  slide?.kill();
  slide = null;
  if (!spot) gsap.set(indicator, { opacity: 0 });
  const moving = spot && visual && (visual.y !== spot.y || visual.height !== spot.height);
  const first = spot && !visual;
  if (spot && (!visual || reducedMotion())) visual = { ...spot };
  if (spot) paint();
  if (reducedMotion()) { introPlayed = true; return; }
  if (moving) {
    slide = gsap.to(visual, { y: spot.y, height: spot.height, duration: .45, ease: 'power3.inOut', onUpdate: paint });
    gsap.fromTo(active.querySelector('.advisor-nav-icon'), { scale: .86, rotation: -8 }, { scale: 1, rotation: 0, duration: .45, delay: .2, ease: 'power3.out', clearProps: 'transform' });
  }
  motion = gsap.context(() => {
    if (first) gsap.fromTo(indicator, { opacity: 0, scaleX: .6 }, { opacity: 1, scaleX: 1, duration: .5, delay: .35, ease: 'power3.out', clearProps: 'scale' });
    if (introPlayed) return;
    introPlayed = true;
    const items = [...sidebar.querySelectorAll('.sidebar-item')];
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => gsap.set([...items, ...sidebar.querySelectorAll('.sidebar-brand, .sidebar-caption, .sidebar-motto, .advisor-profile-card')], { clearProps: 'transform,opacity' }) });
    tl.fromTo(sidebar.querySelectorAll('.sidebar-brand, .sidebar-caption'), { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: .45, stagger: .08 }, 0);
    tl.fromTo(items, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: .4, stagger: .05 }, .15);
    tl.fromTo(sidebar.querySelectorAll('.sidebar-motto'), { opacity: 0 }, { opacity: 1, duration: .5 }, .5);
    tl.fromTo(sidebar.querySelectorAll('.advisor-profile-card'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .55 }, .4);
    for (const ring of sidebar.querySelectorAll('.profile-card-ring .ring-fill')) {
      const target = ring.getAttribute('stroke-dasharray');
      tl.fromTo(ring, { attr: { 'stroke-dasharray': '0 100' } }, { attr: { 'stroke-dasharray': target }, duration: .9, ease: 'power2.out' }, .6);
    }
    for (const node of sidebar.querySelectorAll('[data-sidebar-count]')) {
      const original = node.textContent;
      const target = Number(node.dataset.sidebarCount);
      if (!target) continue;
      const counter = { value: 0 };
      tl.to(counter, { value: target, duration: .9, ease: 'power2.out', onUpdate: () => { node.textContent = Math.round(counter.value).toLocaleString('es-CO'); }, onComplete: () => { node.textContent = original; } }, .6);
    }
  }, sidebar);
}
