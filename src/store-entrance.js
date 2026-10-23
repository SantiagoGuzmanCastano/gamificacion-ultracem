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

// Las tarjetas no se desplazan: aparecen en su sitio y lo que se mueve (la figura,
// los textos y un destello) queda recortado dentro de la propia tarjeta, así nada
// se sale del fondo de Halloween ni de la cuadrícula.
function cardsIn(tl, cards, at, { stagger = .04, art = '.shop-artwork img', copy = '.shop-card-details > *', sheen = '.shop-artwork' } = {}) {
  if (!cards.length) return;
  const inside = selector => cards.flatMap(card => [...card.querySelectorAll(selector)]);
  tl.from(cards, { opacity: 0, scale: .98, duration: .32, stagger, ease: 'power2.out' }, at);
  tl.from(inside(art), { opacity: 0, y: 22, scale: .95, duration: .5, stagger, ease: 'power3.out' }, at + .05);
  tl.from(inside(copy), { opacity: 0, y: 6, duration: .25, stagger: stagger / 2 }, at + .12);
  tl.fromTo(inside(sheen), { '--card-sheen': -140 }, { '--card-sheen': 140, duration: .7, stagger, ease: 'power2.inOut' }, at + .18);
}

const recipes = {
  shop(tl, q) {
    tl.from(q('.shop-heading-copy > :not(.shop-xp)'), { opacity: 0, y: -14, duration: .45, stagger: .08 }, 0);
    tl.from(q('.shop-xp'), { opacity: 0, y: 26, scale: .97, duration: .6 }, .1);
    tl.fromTo(q('.shop-xp'), { '--sheen': -120 }, { '--sheen': 120, duration: 1.3, ease: 'power2.inOut' }, .6);
    tl.from(q('.shop-balance-icon'), { scale: 0, rotation: -200, duration: .8, ease: 'back.out(1.8)' }, .3);
    for (const node of q('.shop-xp [data-count]')) countUp(tl, node, .4);
    tl.from(q('.shop-stage-pedestal'), { scaleX: 0, opacity: 0, duration: .6 }, .2);
    tl.from(q('.shop-stage-art'), { opacity: 0, y: 30, scale: .94, duration: .9, ease: 'power3.out' }, .35);
    tl.from(q('.shop-stage-caption > *'), { opacity: 0, y: 10, duration: .4, stagger: .07 }, .7);
    tl.from(q('.shop-tab'), { opacity: 0, y: 16, duration: .45, stagger: .08 }, .5);
    // El fondo de Halloween termina de aparecer antes de que entren sus tarjetas.
    tl.from(q('#halloween-collection'), { opacity: 0, duration: .3 }, .3);
    tl.from(q('#halloween-collection .halloween-heading > *, #halloween-collection .halloween-meta > *'), { opacity: 0, y: 8, duration: .3, stagger: .04 }, .38);
    cardsIn(tl, [...q('#halloween-collection .shop-card')], .5, { stagger: .07 });
    tl.from(q('#halloween-collection .halloween-mascot'), { opacity: 0, y: 16, scale: .96, duration: .6, ease: 'power3.out' }, .6);
    tl.from(q('.shop-panel:not([hidden]) .shop-collection:not(.halloween-collection) .shop-collection-heading > *'), { opacity: 0, x: -12, duration: .3, stagger: .05 }, .6);
    cardsIn(tl, [...q('.shop-panel:not([hidden]) .shop-collection:not(.halloween-collection) .shop-card, .shop-panel.shop-collection:not([hidden]) .shop-card')], .65, { stagger: .035 });
    tl.from(q('.shop-note'), { opacity: 0, y: 12, duration: .35 }, 1.1);
  },
  rewards(tl, q) {
    tl.from(q('.rewards-heading-copy > *'), { opacity: 0, y: -14, duration: .45, stagger: .08 }, 0);
    tl.from(q('.rewards-balance'), { opacity: 0, y: 26, scale: .97, duration: .6 }, .1);
    tl.fromTo(q('.rewards-balance'), { '--sheen': -120 }, { '--sheen': 120, duration: 1.3, ease: 'power2.inOut' }, .6);
    for (const node of q('.rewards-balance [data-count]')) countUp(tl, node, .4);
    tl.from(q('.rewards-rail-fill'), { scaleX: 0, duration: 1.2, ease: 'power3.inOut' }, .45);
    tl.from(q('.rewards-rail-stop'), { opacity: 0, scale: .7, y: 8, duration: .5, stagger: .1, ease: 'back.out(1.3)' }, .6);
    tl.from(q('.rewards-rail-status'), { opacity: 0, y: 8, duration: .4 }, 1.1);
    tl.from(q('.rewards-featured'), { opacity: 0, duration: .3 }, .3);
    tl.from(q('.rewards-featured .halloween-content > div:first-child > *, .rewards-chips > *'), { opacity: 0, y: 8, duration: .3, stagger: .04 }, .38);
    cardsIn(tl, [...q('.rewards-grid-featured .rewards-card')], .5, { stagger: .07, ...ticketParts });
    tl.from(q('.rewards-featured .halloween-mascot'), { opacity: 0, y: 16, scale: .96, duration: .6, ease: 'power3.out' }, .6);
    tl.from(q('.rewards-filter'), { opacity: 0, y: 10, duration: .3, stagger: .04 }, .55);
    cardsIn(tl, [...q('.rewards-grid-collection .rewards-card')], .65, { stagger: .045, ...ticketParts });
    tl.from(q('.shop-note, .rewards-legal'), { opacity: 0, y: 12, duration: .35, stagger: .08 }, 1.1);
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
export function revealCards(cards, parts = {}) {
  if (!cards.length || reducedMotion()) return;
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => gsap.set([...cards, ...cards.flatMap(card => [...card.querySelectorAll('*')])], { clearProps: 'transform,opacity' }) });
  cardsIn(tl, cards, 0, { stagger: .03, ...parts });
}

export const ticketParts = { art: '.rewards-photo img', copy: '.rewards-card-details > *', sheen: '.rewards-photo' };

// Cambia la figura del probador con un pequeño salto, para que se note qué cambió.
export function swapStageArt(art, update) {
  if (reducedMotion()) { update(); return; }
  gsap.timeline()
    .to(art, { opacity: 0, y: 10, scale: .97, duration: .16, ease: 'power2.in', onComplete: update })
    .to(art, { opacity: 1, y: 0, scale: 1, duration: .5, ease: 'power3.out', clearProps: 'transform,opacity' });
}
