import { gsap } from 'gsap';

let played = false;
let animation = null;
let restoreCounters = [];

export function clearAdvisorEntrance() {
  animation?.revert();
  animation = null;
  restoreCounters.forEach(restore => restore());
  restoreCounters = [];
}

export function resetAdvisorEntrance() {
  clearAdvisorEntrance();
  played = false;
}

function countUp(sequence, node, target, format, at) {
  const original = node.textContent;
  const counter = { value: 0 };
  restoreCounters.push(() => { node.textContent = original; });
  sequence.fromTo(counter, { value: 0 }, {
    value: target, duration: 1, ease: 'power2.out',
    onUpdate: () => { node.textContent = format(counter.value); },
    onComplete: () => { node.textContent = original; },
  }, at);
}

// Una secuencia por cada entrada a Inicio: primero el saludo y el héroe, luego las
// métricas y por último los paneles. Movimientos cortos y sin rebotes fuertes.
export function playAdvisorEntrance(root) {
  if (played) return;
  played = true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const all = selector => [...root.querySelectorAll(selector)];
  animation = gsap.context(() => {
    const touched = [];
    const track = nodes => { touched.push(...nodes); return nodes; };
    const sequence = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => gsap.set(touched, { clearProps: 'transform,opacity' }) });
    sequence.fromTo(track(all('.advisor-welcome > *')), { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: .45, stagger: .08 }, 0);
    sequence.fromTo(track(all('.advisor-welcome-name-line')), { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: .6, ease: 'power2.out' }, .3);
    sequence.fromTo(track(all('.advisor-hero')), { opacity: 0, y: 22, scale: .985 }, { opacity: 1, y: 0, scale: 1, duration: .6 }, .1);
    sequence.fromTo(track(all('.advisor-hero .hero-highlight')), { opacity: 0, x: -18 }, { opacity: 1, x: 0, duration: .45, stagger: .1 }, .35);
    sequence.fromTo(track(all('.advisor-hero .hero-cta')), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .45 }, .7);
    sequence.fromTo(track(all('.advisor-hero-mascot')), { opacity: 0, x: 48 }, { opacity: 1, x: 0, duration: .85 }, .3);
    for (const ring of all('#page .ring-fill')) {
      const target = ring.getAttribute('stroke-dasharray');
      sequence.fromTo(ring, { attr: { 'stroke-dasharray': '0 100' } }, { attr: { 'stroke-dasharray': target }, duration: 1.1, ease: 'power2.inOut' }, .3);
    }
    for (const node of all('.advisor-hero .ring-copy strong')) {
      const target = Number(node.textContent.replace(/\D/g, ''));
      if (target) countUp(sequence, node, target, value => `${Math.round(value)}%`, .3);
    }
    sequence.fromTo(track(all('.advisor-metrics .metric')), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .5, stagger: .08 }, .45);
    sequence.fromTo(track(all('.advisor-metrics .metric-icon')), { scale: .7, rotation: -12 }, { scale: 1, rotation: 0, duration: .6, stagger: .08 }, .5);
    for (const node of all('[data-count-target]')) {
      const target = Number(node.dataset.countTarget);
      const suffix = node.dataset.countSuffix || '';
      countUp(sequence, node, target, value => `${value.toLocaleString('es-CO', { maximumFractionDigits: Number.isInteger(target) ? 0 : 2 })}${suffix}`, .5);
    }
    const panels = ['.advisor-ranking', '.advisor-client-panel', '.tonnage-goal-card', '.weekly-sales-card', '.portfolio-card'].flatMap(all);
    sequence.fromTo(track(panels), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .55, stagger: .1 }, .65);
    sequence.fromTo(track(all('.advisor-ranking .ranking-row')), { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: .4, stagger: .06 }, .85);
    // Podio: la corona y las medallas caen con un pequeño rebote, el 1.º primero.
    sequence.fromTo(track(all('.advisor-ranking .rank-medal svg')), { scale: 0, rotation: -25, transformOrigin: '50% 100%' }, { scale: 1, rotation: 0, duration: .55, stagger: .12, ease: 'back.out(2.2)' }, 1.05);
    sequence.fromTo(track(all('.advisor-client-panel .customer-option, .advisor-client-panel .task')), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .4, stagger: .05 }, .9);
    sequence.fromTo(track(all('.tonnage-track > span')), { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: .9, ease: 'power2.out' }, .9);
    sequence.fromTo(track(all('.weekly-chart-bar')), { scaleY: 0, transformOrigin: 'center bottom' }, { scaleY: 1, duration: .65, stagger: .05, ease: 'power2.out' }, .95);
  }, root);
}
