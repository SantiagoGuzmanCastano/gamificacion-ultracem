// Loader con el logo de Ultracem mientras cargan los datos. Spec: tests/loader.spec.js.
// El logo es el anillo "U" del sidebar; reemplazar por el vectorial oficial cuando Ultracem lo entregue.
import './loader.css';

const controllers = new WeakMap();
const LEAVE_MS = 400;

export function createLoader(container = document.body) {
  const existing = container.querySelector('[data-testid="loader"]');
  if (existing && controllers.has(existing)) return controllers.get(existing);

  const element = document.createElement('div');
  element.className = 'loader';
  element.dataset.testid = 'loader';
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  element.setAttribute('aria-label', 'Cargando Ultracem');
  element.innerHTML = `
    <div class="loader-logo" data-testid="loader-logo">
      <span class="loader-ring" aria-hidden="true"></span>
      <span class="loader-name">ULTRACEM</span>
      <span class="loader-tag">GAMIFICACIÓN</span>
    </div>
    <span class="loader-bar" aria-hidden="true"><i></i></span>`;
  container.append(element);

  let leaving = null;
  const controller = {
    element,
    // Con animate: false (tests) o "reducir movimiento" se quita al instante.
    hide({ animate = true } = {}) {
      if (!element.isConnected) return Promise.resolve();
      if (leaving) return leaving;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!animate || reduced) { element.remove(); return Promise.resolve(); }
      element.classList.add('is-leaving');
      leaving = new Promise(resolve => window.setTimeout(() => { element.remove(); resolve(); }, LEAVE_MS));
      return leaving;
    },
  };
  controllers.set(element, controller);
  return controller;
}
