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

export function playAdvisorEntrance(root) {
  if (played) return;
  played = true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  animation = gsap.context(() => {
    const sequence = gsap.timeline({ defaults: { ease: 'power3.out' } });
    const cards = ['.advisor-welcome', '.advisor-hero', '.advisor-metrics', '.advisor-ranking', '.advisor-client-panel', '.tonnage-goal-card', '.weekly-sales-card', '.portfolio-card']
      .map(selector => root.querySelector(selector)).filter(Boolean);
    sequence.fromTo(cards, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .28, stagger: .07 }, 0);
    sequence.fromTo(root.querySelectorAll('.sidebar-brand, .sidebar-caption, .sidebar-nav, .topbar'),
      { opacity: 0 }, { opacity: 1, duration: .25, stagger: .04 }, 0);
    for (const ring of root.querySelectorAll('.ring-fill')) {
      const target = ring.getAttribute('stroke-dasharray');
      sequence.fromTo(ring, { attr: { 'stroke-dasharray': '0 100' } }, { attr: { 'stroke-dasharray': target }, duration: .9, ease: 'power2.out' }, .25);
    }
    sequence.fromTo(root.querySelectorAll('.tonnage-track > span'),
      { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: .9, ease: 'power2.out' }, .4);
    sequence.fromTo(root.querySelectorAll('.weekly-chart-bar'),
      { scaleY: 0, transformOrigin: 'center bottom' }, { scaleY: 1, duration: .65, stagger: .05, ease: 'power2.out' }, .45);
    for (const node of root.querySelectorAll('[data-count-target]')) {
      const original = node.textContent;
      const target = Number(node.dataset.countTarget);
      const suffix = node.dataset.countSuffix || '';
      const counter = { value: 0 };
      restoreCounters.push(() => { node.textContent = original; });
      sequence.fromTo(counter, { value: 0 }, {
        value: target, duration: .9, ease: 'power2.out',
        onUpdate: () => { node.textContent = `${counter.value.toLocaleString('es-CO', { maximumFractionDigits: Number.isInteger(target) ? 0 : 2 })}${suffix}`; },
        onComplete: () => { node.textContent = original; },
      }, .25);
    }
  }, root);
}
