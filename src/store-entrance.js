import { gsap } from 'gsap';

let played = null;
let entrance = null;

// Sin matchMedia (pruebas en Node) se trata como movimiento reducido.
const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

export function resetStoreEntrance() {
  entrance?.revert();
  entrance = null;
  played = null;
}

function countUp(tl, node, at) {
  const original = node.textContent;
  const target = Number(original.replace(/\D/g, ''));
  if (!target) return;
  const counter = { value: 0 };
  tl.to(counter, {
    value: target, duration: 1.1, ease: 'power2.out',
    onUpdate: () => { node.textContent = Math.round(counter.value).toLocaleString('es-CO'); },
    onComplete: () => { node.textContent = original; },
  }, at);
}

const recipes = {
  shop(tl, q) {
    tl.from(q('.shop-heading-copy > :not(.shop-xp)'), { opacity: 0, y: -14, duration: .45, stagger: .08 }, 0);
    tl.from(q('.shop-xp'), { opacity: 0, y: 26, scale: .97, duration: .6 }, .1);
    tl.fromTo(q('.shop-xp'), { '--sheen': -120 }, { '--sheen': 120, duration: 1.3, ease: 'power2.inOut' }, .6);
    tl.from(q('.shop-balance-icon'), { scale: 0, rotation: -200, duration: .8, ease: 'back.out(1.8)' }, .3);
    for (const node of q('.shop-xp [data-count]')) countUp(tl, node, .4);
    tl.from(q('.shop-stage-pedestal'), { scaleX: 0, opacity: 0, duration: .6 }, .2);
    tl.from(q('.shop-stage-art'), { opacity: 0, y: 46, scale: .86, duration: .8, ease: 'back.out(1.7)' }, .35);
    tl.from(q('.shop-stage-caption > *'), { opacity: 0, y: 10, duration: .4, stagger: .07 }, .7);
    tl.from(q('.shop-tab'), { opacity: 0, y: 16, duration: .45, stagger: .08 }, .5);
    tl.from(q('#halloween-collection'), { opacity: 0, y: 24, duration: .55 }, .7);
    tl.from(q('#halloween-collection .halloween-mascot'), { opacity: 0, x: 40, rotation: 8, duration: .7, ease: 'back.out(1.6)' }, 1);
    tl.from(q('#halloween-collection .shop-card'), { opacity: 0, y: 28, duration: .55, stagger: .1 }, .85);
    tl.from(q('.shop-panel:not([hidden]) .shop-collection:not(.halloween-collection) .shop-collection-heading > *'), { opacity: 0, x: -16, duration: .4, stagger: .08 }, .95);
    tl.from(q('.shop-panel:not([hidden]) .shop-collection:not(.halloween-collection) .shop-card, .shop-panel.shop-collection:not([hidden]) .shop-card'), { opacity: 0, y: 30, scale: .96, duration: .55, stagger: .06 }, 1.05);
    tl.from(q('.shop-note'), { opacity: 0, y: 16, duration: .45 }, 1.5);
  },
  rewards(tl, q) {
    tl.from(q('.rewards-heading-copy > *'), { opacity: 0, y: -14, duration: .45, stagger: .08 }, 0);
    tl.from(q('.rewards-balance'), { opacity: 0, y: 26, scale: .97, duration: .6 }, .1);
    tl.fromTo(q('.rewards-balance'), { '--sheen': -120 }, { '--sheen': 120, duration: 1.3, ease: 'power2.inOut' }, .6);
    for (const node of q('.rewards-balance [data-count]')) countUp(tl, node, .4);
    tl.from(q('.rewards-rail-fill'), { scaleX: 0, duration: 1.2, ease: 'power3.inOut' }, .45);
    tl.from(q('.rewards-rail-stop'), { opacity: 0, scale: .4, y: 8, duration: .45, stagger: .1, ease: 'back.out(2)' }, .6);
    tl.from(q('.rewards-rail-status'), { opacity: 0, y: 8, duration: .4 }, 1.1);
    tl.from(q('.rewards-featured'), { opacity: 0, y: 24, duration: .55 }, .7);
    tl.from(q('.rewards-grid-featured .rewards-card'), { opacity: 0, y: -30, rotation: -4, duration: .7, stagger: .12, ease: 'back.out(1.6)' }, .9);
    tl.from(q('.rewards-featured .halloween-mascot'), { opacity: 0, x: 40, rotation: 8, duration: .7, ease: 'back.out(1.6)' }, 1.05);
    tl.from(q('.rewards-filter'), { opacity: 0, y: 14, duration: .4, stagger: .06 }, 1);
    tl.from(q('.rewards-grid-collection .rewards-card'), { opacity: 0, y: 30, rotation: 1.5, duration: .55, stagger: .08 }, 1.15);
    tl.from(q('.shop-note, .rewards-legal'), { opacity: 0, y: 16, duration: .45, stagger: .1 }, 1.6);
  },
};

// Se reproduce una vez cada vez que se entra a una tienda; los refrescos de datos no la repiten.
export function playStoreEntrance(page, kind) {
  if (played === kind) return;
  entrance?.revert();
  played = kind;
  if (reducedMotion()) return;
  const q = selector => page.querySelectorAll(selector);
  entrance = gsap.context(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => gsap.set(q('*'), { clearProps: 'transform,opacity' }) });
    recipes[kind](tl, q);
  }, page);
}

// Respuesta corta a una acción del usuario (cambiar de pestaña o de filtro).
export function revealCards(cards) {
  if (!cards.length || reducedMotion()) return;
  gsap.fromTo(cards, { opacity: 0, y: 18, scale: .97 }, { opacity: 1, y: 0, scale: 1, duration: .4, stagger: .045, ease: 'power3.out', clearProps: 'transform,opacity' });
}

// Cambia la figura del probador con un pequeño salto, para que se note qué cambió.
export function swapStageArt(art, update) {
  if (reducedMotion()) { update(); return; }
  gsap.timeline()
    .to(art, { opacity: 0, y: 14, scale: .92, duration: .16, ease: 'power2.in', onComplete: update })
    .to(art, { opacity: 1, y: 0, scale: 1, duration: .5, ease: 'back.out(1.8)', clearProps: 'transform,opacity' });
}
