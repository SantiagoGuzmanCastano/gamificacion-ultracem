import { gsap } from 'gsap';

// Entrada y salida del aviso flotante: llega deslizándose desde la derecha y se va igual de suave.
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

export function playNoticeIn(node) {
  gsap.killTweensOf(node);
  if (reduced()) { gsap.set(node, { clearProps: 'transform,opacity' }); return; }
  gsap.fromTo(node, { x: 28, opacity: 0, scale: .98 }, { x: 0, opacity: 1, scale: 1, duration: .45, ease: 'power3.out', clearProps: 'transform,opacity' });
}

export function playNoticeOut(node) {
  gsap.killTweensOf(node);
  const hide = () => { node.hidden = true; gsap.set(node, { clearProps: 'transform,opacity' }); };
  if (reduced()) { hide(); return; }
  gsap.to(node, { x: 20, opacity: 0, duration: .3, ease: 'power2.in', onComplete: hide });
}
