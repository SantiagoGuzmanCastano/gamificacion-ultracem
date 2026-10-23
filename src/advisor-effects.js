import { gsap } from 'gsap';

let confettiTimeline = null;
let confettiLayer = null;

export function clearAdvisorEffects() {
  confettiTimeline?.kill();
  confettiTimeline = null;
  confettiLayer?.remove();
  confettiLayer = null;
}

// Colores de Ultracem: amarillo, azules de la marca y blanco.
const colors = ['#ffd124', '#ffe58a', '#04cce9', '#0072bc', '#063b67', '#ffffff'];
const shapes = ['confetti-ribbon', 'confetti-ribbon', 'confetti-dot', 'confetti-star'];

// Una capa por celebración: si llega otra, la anterior se retira.
function openStage() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  confettiTimeline?.kill();
  confettiLayer?.remove();
  const layer = document.createElement('div');
  layer.className = 'advisor-confetti';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  confettiLayer = layer;
  const sequence = gsap.timeline({ onComplete: () => { layer.remove(); if (confettiLayer === layer) { confettiLayer = null; confettiTimeline = null; } } });
  confettiTimeline = sequence;
  return { layer, sequence };
}

function piece(layer, index) {
  const node = document.createElement('span');
  const shape = shapes[index % shapes.length];
  node.className = `advisor-confetti-piece ${shape}`;
  node.style.background = colors[index % colors.length];
  const size = shape === 'confetti-ribbon' ? [4 + Math.random() * 2, 10 + Math.random() * 6] : shape === 'confetti-dot' ? [6, 6] : [11, 11];
  node.style.width = `${size[0]}px`;
  node.style.height = `${size[1]}px`;
  layer.append(node);
  return node;
}

// Una explosión corta desde un punto: sube, se abre en abanico, cae con un leve
// aleteo y se desvanece. `aim` inclina el abanico (radianes, + hacia la derecha).
function burst({ origin, count, spread, rise, life, aim = 0, delay = 0 }, stage = openStage()) {
  if (!stage) return;
  for (let index = 0; index < count; index++) {
    const node = piece(stage.layer, index);
    const angle = -Math.PI / 2 + aim + (index / (count - 1) - .5) * 1.9 + (Math.random() - .5) * .25;
    const reach = rise * (.55 + Math.random() * .45);
    const x = origin.x + Math.cos(angle) * spread * (.4 + Math.random() * .6);
    const peak = origin.y + Math.sin(angle) * reach;
    const start = delay + Math.random() * .08;
    const duration = life * (.8 + Math.random() * .2);
    const up = duration * .32;
    gsap.set(node, { x: origin.x, y: origin.y, rotation: Math.random() * 180, scale: .6 });
    stage.sequence.to(node, { x, duration, ease: 'power2.out' }, start)
      .to(node, { y: peak, scale: 1, duration: up, ease: 'power3.out' }, start)
      .to(node, { y: peak + 140 + Math.random() * 120, duration: duration - up, ease: 'sine.in' }, start + up)
      .to(node, { rotation: `+=${240 + Math.random() * 360}`, rotationX: 180 + Math.random() * 360, duration, ease: 'none' }, start)
      .to(node, { opacity: 0, duration: duration * .35, ease: 'power1.in' }, start + duration * .65);
  }
}

// Lluvia que cubre toda la pantalla: cada pieza entra por arriba en un punto distinto
// y cae meciéndose de lado a lado hasta salir por abajo.
function shower({ count, life, delay = 0 }, stage) {
  if (!stage) return;
  for (let index = 0; index < count; index++) {
    const node = piece(stage.layer, index + 1);
    const x = (index + Math.random()) / count * window.innerWidth;
    const start = delay + Math.random() * .8;
    const duration = life * (.75 + Math.random() * .4);
    const sway = 30 + Math.random() * 50;
    gsap.set(node, { x, y: -20 - Math.random() * 60, rotation: Math.random() * 180 });
    stage.sequence.to(node, { y: window.innerHeight + 30, duration, ease: 'none' }, start)
      .to(node, { x: x + (Math.random() < .5 ? -sway : sway), duration: duration / 2, ease: 'sine.inOut', yoyo: true, repeat: 1 }, start)
      .to(node, { rotation: `+=${300 + Math.random() * 400}`, rotationX: 180 + Math.random() * 540, duration, ease: 'none' }, start)
      .to(node, { opacity: 0, duration: duration * .2, ease: 'power1.in' }, start + duration * .8);
  }
}

// Punto de salida de la celebración de venta: la cabeza de Topitín, o arriba al centro.
function mascotOrigin() {
  const rect = document.querySelector?.('.advisor-hero-mascot img')?.getBoundingClientRect();
  return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height * .3 } : { x: window.innerWidth / 2, y: window.innerHeight * .3 };
}

export function celebrateTask(origin) {
  burst({ origin, count: 26, spread: 150, rise: 110, life: 1.1 });
}

// Venta confirmada: Topitín lanza su confeti, dos cañones disparan desde las esquinas
// de abajo y una lluvia cubre toda la pantalla.
export function celebrateSale() {
  const stage = openStage();
  if (!stage) return;
  const { innerWidth: width, innerHeight: height } = window;
  const cannon = Math.round(Math.min(36, Math.max(18, width / 40)));
  burst({ origin: mascotOrigin(), count: 40, spread: 380, rise: 220, life: 1.8 }, stage);
  burst({ origin: { x: 0, y: height }, count: cannon, spread: width * .45, rise: height * .7, life: 2, aim: .55, delay: .05 }, stage);
  burst({ origin: { x: width, y: height }, count: cannon, spread: width * .45, rise: height * .7, life: 2, aim: -.55, delay: .05 }, stage);
  // Termina antes de 3,4 s: ese es el margen que main.js reserva antes de volver a pintar.
  shower({ count: Math.round(Math.min(120, Math.max(50, width / 11))), life: 2.1, delay: .15 }, stage);
}

// La campana se sacude para señalar que llegó una notificación nueva.
export function ringNotificationBell() {
  const bell = document.querySelector?.('.notification-bell');
  if (!bell || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.timeline({ delay: .5 })
    .to(bell, { rotation: -16, duration: .08, ease: 'sine.out' })
    .to(bell, { rotation: 14, duration: .12, ease: 'sine.inOut', repeat: 3, yoyo: true })
    .to(bell, { rotation: 0, duration: .2, ease: 'power3.out', clearProps: 'transform' });
}

// Voltea la tarjeta completa y cambia el contenido en el punto más girado. La
// perspectiva vive en el contenedor (CSS) para que el giro no se agrande hacia la pantalla.
export function flipMetric(node, update) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); return; }
  gsap.killTweensOf(node);
  gsap.timeline()
    // Nunca llega a 90°: de canto exacto la proyección se dispara y destella por toda la pantalla.
    .to(node, { rotationX: 75, scale: .97, opacity: .35, transformOrigin: '50% 50%', duration: .24, ease: 'sine.in', onComplete: update })
    .fromTo(node, { rotationX: -75, scale: .97, opacity: .35 }, { rotationX: 0, scale: 1, opacity: 1, duration: .5, ease: 'power3.out', clearProps: 'transform,opacity' });
}

// La gráfica semanal cambia entre ventas y toneladas: las barras crecen o bajan a su
// nueva altura y los números aparecen de nuevo, sin rebotes.
export function morphWeeklyChart(bars, heights, labels) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    bars.forEach((bar, index) => { bar.style.height = heights[index]; });
    return;
  }
  bars.forEach((bar, index) => {
    gsap.killTweensOf(bar, 'height');
    gsap.to(bar, { height: heights[index], duration: .55, delay: index * .03, ease: 'power3.inOut' });
  });
  gsap.fromTo(labels, { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: .32, stagger: .03, ease: 'power2.out', clearProps: 'opacity,transform' });
}
