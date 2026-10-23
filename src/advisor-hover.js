// Hovers vivos de Inicio: un foco de luz que sigue al cursor dentro de cada panel y
// un leve paralaje en el héroe. Solo escribe variables CSS; el CSS decide cómo se ve.
const spotTargets = '.advisor-hero, .advisor-metrics, .advisor-overview .advisor-dashboard-column > section';
let bound = false;

export function bindAdvisorHover() {
  if (bound) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  bound = true;
  let frame = 0;
  let pending = null;
  const paint = () => {
    frame = 0;
    const { target, x, y } = pending;
    const box = target.getBoundingClientRect();
    target.style.setProperty('--spot-x', `${x - box.left}px`);
    target.style.setProperty('--spot-y', `${y - box.top}px`);
    if (target.classList.contains('advisor-hero')) {
      target.style.setProperty('--hero-px', ((x - box.left) / box.width * 2 - 1).toFixed(3));
      target.style.setProperty('--hero-py', ((y - box.top) / box.height * 2 - 1).toFixed(3));
    }
  };
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    const target = event.target.closest?.(`.advisor-shell :is(${spotTargets})`);
    if (!target) return;
    pending = { target, x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(paint);
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    const target = event.target.closest?.('.advisor-shell .advisor-hero');
    if (!target || target.contains(event.relatedTarget)) return;
    target.style.setProperty('--hero-px', '0');
    target.style.setProperty('--hero-py', '0');
  });
}
