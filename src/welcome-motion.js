// Animación GSAP de la intro v2 (loader → vuelo a través del logo → "¡Hola, {nombre}!" → Topitín).
// Se carga solo cuando hay animación (welcome.js la importa de forma dinámica), así los tests de jsdom
// no dependen de GSAP. Excepción aprobada a los tiempos de la guía v1.1: ver animaciones.md §13–14.
import { gsap } from 'gsap';

const anim = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Resuelve al terminar la secuencia; welcome.js programa el cierre automático después.
export function welcomeSequence(root, setStage) {
  if (!anim()) return Promise.resolve();
  const chars = root.querySelectorAll('.welcome-char');
  const mascot = root.querySelector('[data-testid="welcome-mascot"]');
  const image = mascot.querySelector('.welcome-mascot-image');
  const bubble = mascot.querySelector('.welcome-bubble');
  const front = root.querySelector('[data-layer="front"]');
  const depth = root.querySelectorAll('[data-layer="mid"], [data-layer="back"]');
  return new Promise(resolve => {
    gsap.timeline({ onComplete: resolve })
      // Fase 1 · Vuelo falso 3D: la cámara atraviesa el logo (×5 y se desvanece) y el fondo se acerca.
      .set(front, { opacity: 1, scale: 1 })
      .to(front, { scale: 5, opacity: 0, duration: 1.2, ease: 'power2.in' }, .3)
      .fromTo(depth, { scale: 1 }, { scale: 1.1, duration: 1.2, ease: 'power2.out' }, .3)
      // Fase 2 · "¡Hola, {nombre}!" letra por letra con rebote, justo al cruzar el logo.
      .from(chars, { y: 46, opacity: 0, rotationX: -90, filter: 'blur(8px)', duration: .7, stagger: .04, ease: 'back.out(1.7)', clearProps: 'transform,opacity,filter' }, '-=.35')
      // Fase 3 · Topitín entra saltando, saluda y aparece su burbuja.
      .add(() => setStage('mascot'), '-=.15')
      .from(image, { y: 90, opacity: 0, scale: .6, rotation: -8, duration: .75, ease: 'back.out(1.6)', clearProps: 'opacity' })
      .to(image, { rotation: 6, duration: .22, yoyo: true, repeat: 3, ease: 'sine.inOut', onComplete: () => gsap.set(image, { clearProps: 'transform' }) })
      .from(bubble, { scale: 0, opacity: 0, duration: .4, ease: 'back.out(2.4)', clearProps: 'transform,opacity' }, '<');
  });
}

// Salida de la bienvenida antes de quitarla del DOM.
export function welcomeExit(root) {
  if (!anim() || !root) return Promise.resolve();
  return new Promise(resolve => gsap.to(root, { opacity: 0, scale: 1.02, duration: .4, ease: 'power2.in', onComplete: resolve }));
}
