import { gsap } from 'gsap';

// Aviso con Topitín para las acciones que dependen del administrador: dice qué pasó y
// qué sigue, se cierra solo y la barra inferior muestra cuánto le queda.
let current = null;

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

export function clearTopitinToast() {
  current?.dismiss(false);
  current = null;
}

export function showTopitinToast({ title, body, mascot, tone = 'success', duration = 6000 }) {
  clearTopitinToast();
  const toast = document.createElement('section');
  toast.className = `topitin-toast topitin-toast-${tone}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `<img class="topitin-toast-mascot" src="${mascot}" alt="" width="64" height="64">
    <div class="topitin-toast-copy"><strong>${title}</strong><p>${body}</p></div>
    <button type="button" class="topitin-toast-close" aria-label="Cerrar aviso">×</button>
    <span class="topitin-toast-timer" aria-hidden="true"></span>`;
  document.body.append(toast);
  const timer = toast.querySelector('.topitin-toast-timer');
  let closing = false, countdown = null, hideTimer = null;
  const remove = () => { countdown?.kill(); window.clearTimeout(hideTimer); toast.remove(); };
  const dismiss = (animate = true) => {
    if (closing) return;
    closing = true;
    if (current?.toast === toast) current = null;
    if (!animate || reducedMotion()) { remove(); return; }
    gsap.to(toast, { x: 40, opacity: 0, duration: .25, ease: 'power2.in', onComplete: remove });
  };
  toast.querySelector('.topitin-toast-close').addEventListener('click', () => dismiss());
  current = { toast, dismiss };
  if (reducedMotion()) { hideTimer = window.setTimeout(() => dismiss(false), duration); return; }
  gsap.timeline()
    .fromTo(toast, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: .45, ease: 'power3.out' })
    .fromTo(toast.querySelector('.topitin-toast-mascot'), { y: 18, rotation: -12, opacity: 0 }, { y: 0, rotation: 0, opacity: 1, duration: .5, ease: 'back.out(1.6)' }, .1)
    .to(toast.querySelector('.topitin-toast-mascot'), { rotation: 8, duration: .14, ease: 'sine.inOut', repeat: 3, yoyo: true, transformOrigin: '50% 90%' }, .55)
    .fromTo(toast.querySelectorAll('.topitin-toast-copy > *'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .3, stagger: .07 }, .2);
  countdown = gsap.fromTo(timer, { scaleX: 1 }, { scaleX: 0, duration: duration / 1000, ease: 'none', transformOrigin: 'left center', onComplete: () => dismiss() });
  // Pasar el ratón por encima pausa la cuenta para poder leer con calma.
  toast.addEventListener('pointerenter', () => countdown?.pause());
  toast.addEventListener('pointerleave', () => countdown?.resume());
}
