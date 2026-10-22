import { gsap } from 'gsap';

let animation = null;

export function clearLoadingScreen(root) {
  animation?.revert();
  animation = null;
  root.removeAttribute('aria-busy');
}

export function showLoadingScreen(root) {
  clearLoadingScreen(root);
  root.className = 'loading-shell';
  root.setAttribute('aria-busy', 'true');
  root.innerHTML = `<main class="loading-content">
    <img class="loading-logo" src="/ultracem-logo.png" alt="Ultracem" width="220" height="56">
    <svg class="cement-scene" viewBox="0 0 320 110" fill="none" aria-hidden="true">
      <path d="M30 87h260" stroke="#365364" stroke-width="2" stroke-linecap="round"/>
      <g class="cement-cycle">
        <path class="cement-fill" d="M39 85v-9q12-11 27-7t30-3 31 2 30-1 31 2 31-2 31 1 31 8v9Z" fill="#b9bdb8"/>
        <path class="cement-grain" d="m65 79 4 1m40-4 3 1m39 4h4m38-4 3 1m39 1 3 1" stroke="#8b9592" stroke-width="2" stroke-linecap="round"/>
        <g class="cement-pour">
          <path class="cement-stream" d="M160 38q-3 12 0 21t0 17" stroke="#b9bdb8" stroke-width="7" stroke-linecap="round"/>
          <g transform="rotate(24 160 26)">
            <path d="M140 8h34l-3 32h-27Z" fill="#e3e5dd"/>
            <path d="m141 17 32 0-1 11h-30Z" fill="#ffd124"/>
            <path d="M140 8h34m-31 30h28" stroke="#8b9592" stroke-width="2"/>
          </g>
        </g>
      </g>
    </svg>
    <p class="loading-status" role="status">Preparando tu espacio…</p>
    <p class="loading-caption">Construyendo un mundo más fuerte.</p>
  </main>`;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  animation = gsap.context(() => {
    gsap.fromTo('.loading-content', { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .26, ease: 'power3.out', clearProps: 'opacity,transform' });
    const cycle = gsap.timeline({ repeat: -1, repeatDelay: .15 });
    cycle.fromTo('.cement-cycle', { opacity: 1 }, { opacity: 1, duration: .01 })
      .fromTo('.cement-fill', { scaleX: .04, transformOrigin: 'left bottom' }, { scaleX: 1, duration: 2, ease: 'sine.inOut' }, 0)
      .fromTo('.cement-grain', { opacity: 0 }, { opacity: 1, duration: .6 }, 1.3)
      .fromTo('.cement-pour', { x: -116, opacity: 1 }, { x: 116, duration: 2, ease: 'sine.inOut' }, 0)
      .to('.cement-pour', { opacity: 0, duration: .18 }, 1.9)
      .to('.cement-cycle', { opacity: 0, duration: .25 }, 2.3);
  }, root);
}
