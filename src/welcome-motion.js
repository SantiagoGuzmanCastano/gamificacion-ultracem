// Animación GSAP de la bienvenida (loader → vuelo falso 3D → mensaje → Topitín y tareas).
// Se carga solo cuando hay animación (welcome.js la importa de forma dinámica), así los tests de jsdom
// no dependen de GSAP. Excepción aprobada a los tiempos de la guía v1.1: ver animaciones.md §13.
import { gsap } from 'gsap';

const anim = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Resuelve al terminar la secuencia.
export function welcomeSequence(root, setStage) {
  if (!anim()) { setStage('done'); return Promise.resolve(); }
  const chars = root.querySelectorAll('.welcome-char');
  const mascot = root.querySelector('[data-testid="welcome-mascot"]');
  const image = mascot.querySelector('.welcome-mascot-image');
  const bubble = mascot.querySelector('.welcome-bubble');
  const panel = root.querySelector('[data-testid="welcome-tasks"]');
  const items = panel.querySelectorAll('[data-testid="welcome-task"]');
  const close = root.querySelector('[data-testid="welcome-close"]');
  const front = root.querySelector('[data-layer="front"]');
  const depth = root.querySelectorAll('[data-layer="mid"], [data-layer="back"]');
  return new Promise(resolve => {
    // Fase 1 · Vuelo falso 3D: la cámara atraviesa el frente (×5 y se desvanece) y el fondo se acerca.
    const timeline = gsap.timeline({ onComplete: () => { setStage('done'); resolve(); } })
      .set(front, { opacity: 1, scale: 1 })
      .to(front, { scale: 5, opacity: 0, duration: 1.2, ease: 'power2.in' }, .3)
      .fromTo(depth, { scale: 1 }, { scale: 1.1, duration: 1.2, ease: 'power2.out' }, .3)
      // Fase 2 · Mensaje letra por letra con rebote, justo al cruzar el frente.
      .from(chars, { y: 46, opacity: 0, rotationX: -90, filter: 'blur(8px)', duration: .7, stagger: .028, ease: 'back.out(1.7)', clearProps: 'transform,opacity,filter' }, '-=.35')
      // Fase 3 · Topitín y panel de tareas en cascada.
      .add(() => setStage('mascot'), '-=.15')
      .from(image, { y: 90, opacity: 0, scale: .6, rotation: -8, duration: .75, ease: 'back.out(1.6)', clearProps: 'opacity' })
      .to(image, { rotation: 6, duration: .22, yoyo: true, repeat: 3, ease: 'sine.inOut', onComplete: () => gsap.set(image, { clearProps: 'transform' }) })
      .from(bubble, { scale: 0, opacity: 0, duration: .4, ease: 'back.out(2.4)', clearProps: 'transform,opacity' }, '<')
      .add(() => setStage('tasks'), '-=.4')
      .from(panel, { x: 40, opacity: 0, duration: .55, ease: 'power3.out', clearProps: 'transform,opacity' }, '<');
    if (items.length) timeline.from(items, { y: 12, opacity: 0, duration: .35, stagger: .07, ease: 'power2.out', clearProps: 'transform,opacity' }, '-=.25');
    timeline.add(() => setStage('done')).from(close, { y: 10, opacity: 0, duration: .35, ease: 'power3.out', clearProps: 'transform,opacity' });
  });
}

// Salida de la bienvenida antes de quitarla del DOM.
export function welcomeExit(root) {
  if (!anim() || !root) return Promise.resolve();
  return new Promise(resolve => gsap.to(root, { opacity: 0, scale: 1.02, duration: .4, ease: 'power2.in', onComplete: resolve }));
}
