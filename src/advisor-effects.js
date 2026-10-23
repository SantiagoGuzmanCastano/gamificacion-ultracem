import { gsap } from 'gsap';

let confettiTimeline = null;
let confettiLayer = null;
let recommendationAnimation = null;

export function clearAdvisorEffects() {
  confettiTimeline?.kill();
  confettiTimeline = null;
  confettiLayer?.remove();
  confettiLayer = null;
  recommendationAnimation?.revert();
  recommendationAnimation = null;
}

function startLayer(className) {
  confettiTimeline?.kill();
  confettiLayer?.remove();
  const layer = document.createElement('div');
  layer.className = className;
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  confettiLayer = layer;
  const sequence = gsap.timeline({ onComplete: () => { layer.remove(); if (confettiLayer === layer) { confettiLayer = null; confettiTimeline = null; } } });
  confettiTimeline = sequence;
  return { layer, sequence };
}

// §14: sin confeti saturado. Una tarea suelta una ráfaga corta desde el botón.
function confetti(origin) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { layer, sequence } = startLayer('advisor-confetti confetti-task');
  const colors = ['#05c8e8', '#26e5ba', '#ffd124', '#bf8af5', '#ff7598'];
  const count = 12;
  for (let index = 0; index < count; index++) {
    const piece = document.createElement('span');
    piece.className = 'advisor-confetti-piece';
    piece.style.background = colors[index % colors.length];
    piece.style.borderRadius = index % 3 === 0 ? '50%' : '2px';
    piece.style.width = `${index % 5 === 0 ? 4 : 6 + Math.random() * 3}px`;
    piece.style.height = `${index % 3 === 0 ? 7 : 10 + Math.random() * 5}px`;
    layer.append(piece);
    const { x, y } = origin;
    const start = Math.random() * .04;
    const duration = 1.15 + Math.random() * .35;
    gsap.set(piece, { x, y, rotation: Math.random() * 180, rotationX: Math.random() * 90, scale: .7 + Math.random() * .5 });
    const spread = (index / (count - 1) - .5) * 200 + (Math.random() - .5) * 20;
    const riseDuration = .3 + Math.random() * .12;
    sequence.to(piece, { rotation: 240 + Math.random() * 540, rotationX: 360 + Math.random() * 540, rotationY: 180 + Math.random() * 360, duration, ease: 'none' }, start)
      .to(piece, { x: x + spread, duration, ease: 'power1.out' }, start)
      .to(piece, { y: y - 45 - Math.random() * 70, duration: riseDuration, ease: 'power2.out' }, start)
      .to(piece, { y: y + 65 + Math.random() * 70, duration: duration - riseDuration, ease: 'power1.in' }, start + riseDuration)
      .to(piece, { opacity: 0, duration: .28, ease: 'power1.out' }, start + duration - .28);
  }
}

export function celebrateTask(origin) {
  confetti(origin);
}

// Venta confirmada: destello dorado de 1,1 s en lugar de la lluvia de 96 piezas.
export function celebrateSale() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { layer, sequence } = startLayer('advisor-sale-flash');
  sequence.fromTo(layer, { opacity: 0 }, { opacity: 1, duration: .25, ease: 'power2.out' })
    .to(layer, { opacity: 0, duration: .85, ease: 'power2.in' });
}

export function revealRecommendation(result) {
  recommendationAnimation?.revert();
  recommendationAnimation = null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  recommendationAnimation = gsap.context(() => {
    gsap.fromTo(result, { opacity: 0, y: 8, scale: .99 }, { opacity: 1, y: 0, scale: 1, duration: .28, ease: 'power3.out' });
    gsap.fromTo(result.querySelector('.assistant-result-text'), { opacity: 0, y: 4 }, { opacity: 1, y: 0, delay: .08, duration: .28, ease: 'power3.out' });
    gsap.fromTo(result.querySelector('.assistant-result-icon'), { scale: .9, rotation: -12 }, { scale: 1, rotation: 0, duration: .4, ease: 'back.out(1.3)' });
  }, result);
}
