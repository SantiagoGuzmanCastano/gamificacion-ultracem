// Animaciones de la interfaz. Especificación: animaciones.md (inspirada en Copiloto Ultracem.html).
import { gsap } from 'gsap';
import './motion.css';
import { CONFETTI_COLORS, confettiVector, formatCount, shakeOffsets } from './motion-utils.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
export const anim = () => !reducedMotion.matches;

let float = null;
let cheer = null;

// Quita los transform en línea para no anular el :hover del CSS.
const reset = node => gsap.set(node, { clearProps: 'transform,translate,rotate,scale' });

function layer() {
  let node = document.querySelector('#fx');
  if (!node) {
    node = document.createElement('div');
    node.id = 'fx';
    node.className = 'fx-layer';
    node.setAttribute('aria-hidden', 'true');
    document.body.append(node);
  }
  return node;
}

function toastNode() {
  let node = document.querySelector('#toast');
  if (!node) {
    node = document.createElement('div');
    node.id = 'toast';
    node.className = 'toast';
    node.hidden = true;
    node.addEventListener('click', () => hideToast());
    document.body.append(node);
  }
  return node;
}

// A7 · Toast superior. Los errores quedan fijos hasta un clic o el siguiente aviso.
export function toast(text, error = false) {
  const node = toastNode();
  gsap.killTweensOf(node);
  if (!text) { hideToast(); return; }
  node.textContent = text;
  node.hidden = false;
  node.classList.toggle('toast-error', error);
  node.setAttribute('role', error ? 'alert' : 'status');
  node.title = error ? 'Clic para cerrar' : '';
  if (anim()) gsap.fromTo(node, { y: -14, opacity: 0 }, { y: 0, opacity: 1, duration: .3, ease: 'power3.out' });
  else gsap.set(node, { y: 0, opacity: 1 });
  if (!error) gsap.to(node, { opacity: 0, y: anim() ? -10 : 0, delay: 2.6, duration: anim() ? .3 : 0, onComplete: () => { node.hidden = true; } });
}

export function hideToast() {
  const node = toastNode();
  gsap.killTweensOf(node);
  if (node.hidden) return;
  gsap.to(node, { opacity: 0, y: anim() ? -10 : 0, duration: anim() ? .2 : 0, onComplete: () => { node.hidden = true; } });
}

// Detiene animaciones sobre nodos que render() está por reemplazar.
export function killFx() {
  if (float) { float.kill(); float = null; }
  if (cheer) { cheer.kill(); cheer = null; }
  const page = document.querySelector('#page');
  if (page) gsap.killTweensOf(page.querySelectorAll('*'));
}

// A3 · Contador numérico.
export function countUp(node, from, to, duration = .9) {
  const format = { pre: node.dataset.pre || '', suf: node.dataset.suf || '' };
  if (!anim() || from === to) { node.textContent = formatCount(to, format); return; }
  const state = { v: from };
  node.textContent = formatCount(from, format);
  gsap.to(state, { v: to, duration, ease: 'power2.out', onUpdate: () => { node.textContent = formatCount(state.v, format); } });
}

// A4 · Pulso.
export function pulse(node, scale = 1.18, duration = .18) {
  if (!anim() || !node) return;
  gsap.fromTo(node, { scale: 1 }, { scale, duration, yoyo: true, repeat: 1, ease: 'power2.out', onComplete: () => reset(node) });
}

// A10 · Aparición de un bloque nuevo.
export function appear(node, delay = .6) {
  if (!anim() || !node) return;
  gsap.fromTo(node, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .5, delay, ease: 'power3.out', onComplete: () => { reset(node); gsap.set(node, { clearProps: 'opacity' }); } });
}

// Salida de elementos que se van a borrar (§6.4, §6.11). Resuelve al terminar.
export function exit(nodes, direction = 1) {
  const list = [...nodes].filter(Boolean);
  if (!anim() || !list.length) return Promise.resolve();
  return new Promise(resolve => {
    gsap.to(list, { x: 24 * direction, opacity: 0, duration: .35, stagger: .06, ease: 'power2.in', onComplete: resolve });
  });
}

// A1 + A2 + A3 + A8 · Entrada de una vista.
export function enter(scope, selector, { counts = true } = {}) {
  if (!scope) return;
  const items = scope.querySelectorAll(selector);
  const bars = scope.querySelectorAll('[data-bar] > i');
  if (anim()) {
    if (items.length) gsap.from(items, { y: 18, opacity: 0, duration: .5, stagger: counts ? .07 : .05, ease: 'power3.out', clearProps: 'transform,opacity' });
    if (bars.length) gsap.from(bars, { scaleX: 0, duration: .9, delay: .25, stagger: .05, ease: 'power2.out', clearProps: 'transform' });
  }
  if (counts) scope.querySelectorAll('[data-count]').forEach(node => countUp(node, 0, Number(node.dataset.count), 1));
  // Anillo de avance: de 0 a su valor en 1.200 ms (guía v1.1 p. 23).
  scope.querySelectorAll('[data-ring]').forEach(node => ring(node, 0, Number(node.dataset.ring), 1.2));
  const mascot = scope.querySelector('.mascot-image');
  if (mascot && anim()) {
    gsap.from(mascot, { y: 26, opacity: 0, scale: .88, duration: .6, delay: .5, ease: 'back.out(1.7)', clearProps: 'transform,opacity' });
  }
  mascotIdle(mascot, 1.2);
}

function ring(node, from, to, duration) {
  if (!anim() || from === to) return;
  gsap.fromTo(node, { attr: { 'stroke-dashoffset': 100 - from } }, { attr: { 'stroke-dashoffset': 100 - to }, duration, ease: 'power2.out' });
}

// A8 · Flotación de la mascota en reposo.
export function mascotIdle(mascot = document.querySelector('.mascot-image'), delay = 0) {
  if (float) { float.kill(); float = null; }
  if (!anim() || !mascot) return;
  float = gsap.to(mascot, { y: -5, rotation: 1.4, duration: 1.9, yoyo: true, repeat: -1, ease: 'sine.inOut', delay });
}

// Estado visible antes de re-renderizar, para animar desde los valores anteriores (§4).
export function snapshot() {
  const counts = new Map(), bars = new Map(), rows = new Map(), keys = new Set();
  document.querySelectorAll('[data-count][data-key]').forEach(node => counts.set(node.dataset.key, Number(node.dataset.count)));
  document.querySelectorAll('[data-bar][data-key]').forEach(node => bars.set(node.dataset.key, Number(node.dataset.bar)));
  document.querySelectorAll('[data-ring][data-key]').forEach(node => bars.set(node.dataset.key, Number(node.dataset.ring)));
  document.querySelectorAll('.ranking-row[data-k]').forEach(node => rows.set(node.dataset.k, node.getBoundingClientRect().top));
  document.querySelectorAll('[data-enter-key]').forEach(node => keys.add(node.dataset.enterKey));
  const leader = document.querySelector('.ranking-row[data-k]')?.dataset.k ?? null;
  const view = document.querySelector('#page')?.className ?? '';
  return { counts, bars, rows, keys, leader, view };
}

// Después de un render sin entrada: contadores, barras, FLIP y bloques nuevos.
export function update(before) {
  if (!before) return null;
  document.querySelectorAll('[data-count][data-key]').forEach(node => {
    const previous = before.counts.get(node.dataset.key), next = Number(node.dataset.count);
    if (previous === undefined || previous === next) return;
    countUp(node, previous, next, .7);
    if (next > previous) pulse(node, node.closest('.ranking-row') ? 1.25 : 1.18);
  });
  document.querySelectorAll('[data-bar][data-key]').forEach(node => {
    const previous = before.bars.get(node.dataset.key), next = Number(node.dataset.bar);
    if (previous === undefined || previous === next || !anim()) return;
    gsap.fromTo(node.firstElementChild, { width: `${previous}%` }, { width: `${next}%`, duration: .8, ease: 'power2.out' });
  });
  document.querySelectorAll('[data-ring][data-key]').forEach(node => {
    const previous = before.bars.get(node.dataset.key);
    if (previous !== undefined) ring(node, previous, Number(node.dataset.ring), .8);
  });
  if (anim()) {
    document.querySelectorAll('.ranking-row[data-k]').forEach(node => {
      const top = before.rows.get(node.dataset.k);
      if (top === undefined) return;
      const dy = top - node.getBoundingClientRect().top;
      if (dy) gsap.from(node, { y: dy, duration: .65, ease: 'power3.inOut', onComplete: () => reset(node) });
    });
  }
  document.querySelectorAll('[data-enter-key]').forEach(node => {
    if (before.view === document.querySelector('#page')?.className && !before.keys.has(node.dataset.enterKey)) appear(node, 0);
  });
  const leader = document.querySelector('.ranking-row[data-k]');
  if (before.leader && leader && leader.dataset.k !== before.leader) return leader.dataset.name || null;
  return null;
}

// A5 · Chip flotante "+N" sobre el origen.
export function chip(text, origin) {
  if (!anim() || !origin) return;
  const node = document.createElement('span');
  node.className = 'fx-chip';
  node.textContent = text;
  node.style.left = `${origin.left + origin.width / 2 - 30}px`;
  node.style.top = `${origin.top}px`;
  layer().append(node);
  gsap.timeline({ onComplete: () => node.remove() })
    .fromTo(node, { y: 0, opacity: 0, scale: .7 }, { y: -46, opacity: 1, scale: 1, duration: .35, ease: 'back.out(2)' }, 0)
    .to(node, { y: -86, opacity: 0, duration: .5, ease: 'power1.in' }, .55);
}

// A6 · Ráfaga de confeti desde el origen.
export function burst(origin, count = 26, speed = [70, 180]) {
  if (!anim() || !origin) return;
  const fx = layer(), x = origin.left + origin.width / 2, y = origin.top + 8;
  for (let index = 0; index < count; index++) {
    const piece = document.createElement('i');
    piece.className = 'fx-confetti';
    piece.style.background = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    fx.append(piece);
    const vector = confettiVector(Math.random, speed);
    gsap.timeline({ onComplete: () => piece.remove() })
      .fromTo(piece, { x: 0, y: 0, opacity: 1, rotation: 0 }, { x: vector.x, y: vector.y, rotation: vector.rotation, duration: .55, ease: 'power2.out' }, .05)
      .to(piece, { y: `+=110`, opacity: 0, duration: .7, ease: 'power1.in' }, .6);
  }
}

// A8 · Salto de la mascota con burbuja.
export function mascotCheer(text) {
  const mascot = document.querySelector('.mascot');
  const image = mascot?.querySelector('.mascot-image');
  if (!anim() || !image || cheer) return;
  if (float) float.pause();
  const bubble = document.createElement('span');
  bubble.className = 'mascot-bubble';
  bubble.textContent = text;
  mascot.append(bubble);
  // Si render() la interrumpe, killFx() la mata y libera el turno para la siguiente.
  cheer = gsap.timeline({ onComplete: () => { bubble.remove(); cheer = null; } })
    .fromTo(image, { y: 0, scale: 1 }, { y: -18, scale: 1.08, duration: .2, yoyo: true, repeat: 1, ease: 'power2.out' }, .1)
    .add(() => float?.play(), .5)
    .fromTo(bubble, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .35, ease: 'back.out(2.4)' }, .25)
    .to(bubble, { scale: .9, opacity: 0, duration: .3 }, 1.8);
}

// Check con rebote (§6.1, §6.8).
export function checkPop(node) {
  if (!anim() || !node) return;
  gsap.fromTo(node, { scale: .3, rotation: -25 }, { scale: 1, rotation: 0, duration: .6, ease: 'back.out(3)', onComplete: () => reset(node) });
}

// Latido de una fila o tarjeta.
export function beat(node, scale = 1.02) {
  if (!anim() || !node) return;
  gsap.fromTo(node, { scale: 1 }, { scale, duration: .14, yoyo: true, repeat: 1, ease: 'power1.out', onComplete: () => reset(node) });
}

// Desvanece un botón que se va a retirar.
export function fadeOut(node) {
  if (!anim() || !node) return;
  gsap.to(node, { opacity: 0, scale: .9, duration: .25 });
}

// Temblor de formulario con error (§6.15).
export function shake(node) {
  if (!anim() || !node) return;
  const timeline = gsap.timeline({ onComplete: () => reset(node) });
  shakeOffsets.slice(1).forEach(x => timeline.to(node, { x, duration: .35 / (shakeOffsets.length - 1), ease: 'sine.inOut' }));
}

// Puntos que laten dentro de un botón mientras espera (§6.5). Devuelve la función para detenerlos.
export function loadingDots(control, label) {
  control.textContent = anim() ? label : `${label}…`;
  if (!anim()) return () => {};
  const dots = [0, 1, 2].map(() => {
    const dot = document.createElement('span');
    dot.className = 'loading-dot';
    dot.textContent = '.';
    control.append(dot);
    return dot;
  });
  const tween = gsap.fromTo(dots, { opacity: .3 }, { opacity: 1, duration: .6, yoyo: true, repeat: -1, stagger: .15 });
  return () => tween.kill();
}

// Fundido suave al cambiar de tema (§6.13).
export function themeFade(node) {
  if (!anim() || !node) return;
  gsap.fromTo(node, { opacity: .85 }, { opacity: 1, duration: .2, clearProps: 'opacity' });
}

// Bienvenida inmersiva: letras que caen girando y se enfocan → Topitín entra saltando y saluda con
// burbuja → panel de tareas → botón para seguir. Resuelve al terminar.
export function welcomeSequence(root, setStage) {
  if (!anim()) { setStage('done'); return Promise.resolve(); }
  const chars = root.querySelectorAll('.welcome-char');
  const mascot = root.querySelector('[data-testid="welcome-mascot"]');
  const image = mascot.querySelector('.welcome-mascot-image');
  const bubble = mascot.querySelector('.welcome-bubble');
  const panel = root.querySelector('[data-testid="welcome-tasks"]');
  const items = panel.querySelectorAll('[data-testid="welcome-task"]');
  const close = root.querySelector('[data-testid="welcome-close"]');
  const front = root.querySelector('[data-layer="front"]');
  const depth = root.querySelectorAll('[data-layer="mid"], [data-layer="back"]');
  return new Promise(resolve => {
    // Fase 1 · Vuelo falso 3D: la cámara atraviesa el frente (×5 y se desvanece) y el fondo se acerca.
    // Excepción a la guía v1.1 solo para esta intro (animaciones.md §13): cada paso ≤ 1,2 s.
    const timeline = gsap.timeline({ onComplete: () => { setStage('done'); resolve(); } })
      .set(front, { opacity: 1, scale: 1 })
      .to(front, { scale: 5, opacity: 0, duration: 1.2, ease: 'power2.in' }, .3)
      .fromTo(depth, { scale: 1 }, { scale: 1.1, duration: 1.2, ease: 'power2.out' }, .3)
      // Fase 2 · Mensaje letra por letra con rebote, justo al cruzar el frente.
      .from(chars, { y: 46, opacity: 0, rotationX: -90, filter: 'blur(8px)', duration: .7, stagger: .028, ease: 'back.out(1.7)', clearProps: 'transform,opacity,filter' }, '-=.35')
      // Fase 3 · Topitín y panel de tareas en cascada.
      .add(() => setStage('mascot'), '-=.15')
      .from(image, { y: 90, opacity: 0, scale: .6, rotation: -8, duration: .75, ease: 'back.out(1.6)', clearProps: 'opacity' })
      .to(image, { rotation: 6, duration: .22, yoyo: true, repeat: 3, ease: 'sine.inOut', onComplete: () => gsap.set(image, { clearProps: 'transform' }) })
      .from(bubble, { scale: 0, opacity: 0, duration: .4, ease: 'back.out(2.4)', clearProps: 'transform,opacity' }, '<')
      .add(() => setStage('tasks'), '-=.4')
      .from(panel, { x: 40, opacity: 0, duration: .55, ease: 'power3.out', clearProps: 'transform,opacity' }, '<');
    if (items.length) timeline.from(items, { y: 12, opacity: 0, duration: .35, stagger: .07, ease: 'power2.out', clearProps: 'transform,opacity' }, '-=.25');
    timeline.add(() => setStage('done')).from(close, { y: 10, opacity: 0, duration: .35, ease: 'power3.out', clearProps: 'transform,opacity' });
  });
}

// Salida de la bienvenida antes de quitarla del DOM.
export function welcomeExit(root) {
  if (!anim() || !root) return Promise.resolve();
  return new Promise(resolve => gsap.to(root, { opacity: 0, scale: 1.02, duration: .4, ease: 'power2.in', onComplete: resolve }));
}

// Salida de la sección Halloween (§6.9).
export function leave(node) {
  if (!anim()) { node.remove(); return; }
  gsap.to(node, { opacity: 0, y: -10, duration: .3, onComplete: () => node.remove() });
}
