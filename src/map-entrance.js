import { gsap } from 'gsap';

// Entrada del Mapa clientela con GSAP: la cabecera y el panel del mapa al llegar, y la
// lista de zonas cuando termina de cargar. Se reproduce una vez por visita a la pestaña.
let entered = false;
let entrance = null;

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

export function resetMapEntrance() {
  entrance?.revert();
  entrance = null;
  entered = false;
}

export function playMapEntrance(page) {
  if (entered) return;
  entered = true;
  if (reducedMotion()) return;
  const q = selector => page.querySelectorAll(selector);
  entrance = gsap.context(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => gsap.set(q('.map-welcome *, .advisor-map-panel'), { clearProps: 'transform,opacity' }) });
    tl.from(q('.map-welcome-copy > h1, .map-welcome-copy > p'), { opacity: 0, y: -14, duration: .45, stagger: .08 }, 0);
    tl.from(q('.map-welcome .advisor-calendar'), { opacity: 0, x: 18, duration: .45 }, .1);
    tl.from(q('.map-chip'), { opacity: 0, y: 10, scale: .8, duration: .45, stagger: .08, ease: 'back.out(2)' }, .25);
    tl.from(q('.advisor-map-panel'), { opacity: 0, y: 28, scale: .985, duration: .7 }, .2);
    tl.from(q('.advisor-map-panel .empty-state'), { opacity: 0, y: 14, duration: .45 }, .6);
  }, page);
}

// La lista de zonas llega después (carga asíncrona): entra por su cuenta.
export function revealZoneList(list) {
  if (!list || reducedMotion()) return;
  const items = [...list.querySelectorAll('.zone-item')];
  gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => gsap.set([list, ...list.querySelectorAll('*')], { clearProps: 'transform,opacity' }) })
    .from(list.querySelectorAll('.zone-list-head > *'), { opacity: 0, x: -14, duration: .4, stagger: .06 }, 0)
    .from(items, { opacity: 0, y: 18, duration: .45, stagger: .07 }, .1)
    .from(list.querySelectorAll('.zone-progress-fill'), { scaleX: 0, transformOrigin: '0 50%', duration: .9, stagger: .07, ease: 'power3.inOut' }, .3)
    .from(list.querySelectorAll('.zone-rank'), { scale: 0, rotation: -90, duration: .5, stagger: .07, ease: 'back.out(2)' }, .25);
}
