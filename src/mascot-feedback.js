import { gsap } from 'gsap';

let animation = null;
let dismissTimer = null;
let bubble = null;

export function getMascotFeedbackMessage(event, completedTasks = 1) {
  if (event === 'sale') return '¡Venta confirmada! ¡Buen trabajo!';
  if (event !== 'task') return null;
  const messages = ['¡Primer paso completado!', '¡Cada paso cuenta!', '¡Vas con todo!', '¡Buen trabajo! Ya puedes confirmar la venta.'];
  return messages[Math.min(3, Math.max(0, completedTasks - 1))];
}

export function clearMascotFeedback() {
  window.clearTimeout(dismissTimer);
  animation?.revert();
  animation = null;
  bubble?.remove();
  bubble = null;
}

export function showMascotFeedback(event, completedTasks) {
  const text = getMascotFeedbackMessage(event, completedTasks);
  if (!text) return;
  clearMascotFeedback();
  const mascot = document.querySelector('.advisor-hero-mascot');
  if (!mascot) return;
  bubble = document.createElement('span');
  bubble.className = 'mascot-feedback';
  bubble.textContent = text;
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-live', 'polite');
  mascot.append(bubble);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    animation = gsap.context(() => {
      gsap.timeline()
        .fromTo(bubble, { autoAlpha: 0, y: 8, scale: .96 }, { autoAlpha: 1, y: 0, scale: 1, duration: .2, ease: 'power3.out' })
        .to(bubble, { autoAlpha: 0, y: 4, duration: .16, ease: 'power2.out' }, '+=2.8');
      gsap.timeline()
        .to(mascot.querySelector('img'), { y: -6, rotation: event === 'sale' ? -2 : 0, duration: .18, ease: 'power2.out' })
        .to(mascot.querySelector('img'), { y: 0, rotation: 0, duration: .22, ease: 'power2.out' });
      const heart = document.createElement('span');
      heart.className = 'mascot-feedback-heart';
      heart.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="mascot-heart-fill" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#ffd1e0"/><stop offset=".42" stop-color="#ff7da7"/><stop offset="1" stop-color="#df306a"/></linearGradient></defs><path d="M24 42S6 30.6 6 18a10 10 0 0 1 18-6 10 10 0 0 1 18 6c0 12.6-18 24-18 24Z" fill="url(#mascot-heart-fill)" stroke="#ffb2cd" stroke-width="1.2"/><path d="M11 19c-.6-4 1.8-7 5-7" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2.4" stroke-linecap="round"/><path class="heart-sparkle" d="m40 2 1.7 4.3L46 8l-4.3 1.7L40 14l-1.7-4.3L34 8l4.3-1.7Z" fill="#fff1b0"/></svg>';
      heart.setAttribute('aria-hidden', 'true');
      mascot.append(heart);
      gsap.timeline({ onComplete: () => heart.remove() })
        .fromTo(heart, { autoAlpha: 0, xPercent: -50, x: 0, y: 8, scale: .85, rotation: -10 }, { autoAlpha: 1, x: -6, y: -10, scale: 1.08, rotation: 4, duration: .25, ease: 'back.out(1.4)' })
        .to(heart, { x: -12, y: -32, scale: 1, rotation: -4, duration: .3, ease: 'sine.inOut' })
        .to(heart, { x: 18, y: -108, autoAlpha: 0, scale: .9, rotation: 9, duration: .8, ease: 'power2.out' });
      gsap.fromTo(heart.querySelector('.heart-sparkle'), { opacity: 0, scale: .75, transformOrigin: 'center' }, { opacity: 1, scale: 1, duration: .25, delay: .15, repeat: 1, yoyo: true });
      return () => heart.remove();
    }, mascot);
  }
  dismissTimer = window.setTimeout(clearMascotFeedback, 3300);
}
