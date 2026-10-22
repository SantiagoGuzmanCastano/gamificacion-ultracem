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

function confetti(rain, origin) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  confettiTimeline?.kill();
  confettiLayer?.remove();
  const layer = document.createElement('div');
  layer.className = `advisor-confetti ${rain ? 'confetti-sale' : 'confetti-task'}`;
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  confettiLayer = layer;
  const colors = ['#05c8e8', '#26e5ba', '#ffd124', '#bf8af5', '#ff7598'];
  const sequence = gsap.timeline({ onComplete: () => { layer.remove(); if (confettiLayer === layer) { confettiLayer = null; confettiTimeline = null; } } });
  confettiTimeline = sequence;
  const count = rain ? 96 : 36;
  for (let index = 0; index < count; index++) {
    const piece = document.createElement('span');
    piece.className = 'advisor-confetti-piece';
    piece.style.background = colors[index % colors.length];
    piece.style.borderRadius = index % 3 === 0 ? '50%' : '2px';
    piece.style.width = `${index % 5 === 0 ? 4 : 6 + Math.random() * 3}px`;
    piece.style.height = `${index % 3 === 0 ? 7 : 10 + Math.random() * 5}px`;
    layer.append(piece);
    const x = rain ? (index + Math.random()) / count * window.innerWidth : origin.x;
    const y = rain ? -20 : origin.y;
    const start = rain ? index % 3 * .2 + Math.random() * .45 : Math.random() * .04;
    const duration = rain ? 2.4 + Math.random() : 1.15 + Math.random() * .35;
    gsap.set(piece, { x, y, rotation: Math.random() * 180, rotationX: Math.random() * 90, scale: .7 + Math.random() * .5 });
    sequence.to(piece, { rotation: 240 + Math.random() * 540, rotationX: 360 + Math.random() * 540,
      rotationY: 180 + Math.random() * 360, duration, ease: 'none' }, start);
    if (rain) {
      sequence.to(piece, { x: x + (Math.random() - .5) * 150, duration, ease: 'sine.inOut' }, start)
        .to(piece, { y: window.innerHeight + 30, duration, ease: 'power1.in' }, start);
    } else {
      const spread = (index / (count - 1) - .5) * 250 + (Math.random() - .5) * 20;
      const riseDuration = .3 + Math.random() * .12;
      sequence.to(piece, { x: x + spread, duration, ease: 'power1.out' }, start)
        .to(piece, { y: y - 45 - Math.random() * 85, duration: riseDuration, ease: 'power2.out' }, start)
        .to(piece, { y: y + 65 + Math.random() * 85, duration: duration - riseDuration, ease: 'power1.in' }, start + riseDuration);
    }
    sequence.to(piece, { opacity: 0, duration: .28, ease: 'power1.out' }, start + duration - .28);
  }
}

export function celebrateTask(origin) {
  confetti(false, origin);
}

export function celebrateSale() {
  confetti(true);
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
