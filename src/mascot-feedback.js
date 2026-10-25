import { gsap } from 'gsap';

let animation = null;
let dismissTimer = null;
let bubble = null;

export function getMascotFeedbackMessage(event, completedTasks = 1) {
  if (event === 'sale') return '¡Venta confirmada! +100 puntos';
  if (event === 'secret') return 'Psst… tengo un secreto. Revisa tus notificaciones.';
  if (event !== 'task') return null;
  const messages = ['¡Primer paso completado!', '¡Cada paso cuenta!', '¡Vas con todo!', '¡Ya puedes confirmar la venta!'];
  // Cada tarea suma 5 puntos y Topitín lo dice.
  return `${messages[Math.min(3, Math.max(0, completedTasks - 1))]} +5 puntos`;
}

export function clearMascotFeedback() {
  window.clearTimeout(dismissTimer);
  animation?.revert();
  animation = null;
  bubble?.remove();
  bubble = null;
}

const heartSvg = '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="mascot-heart-fill" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#ffd1e0"/><stop offset=".42" stop-color="#ff7da7"/><stop offset="1" stop-color="#df306a"/></linearGradient></defs><path d="M24 42S6 30.6 6 18a10 10 0 0 1 18-6 10 10 0 0 1 18 6c0 12.6-18 24-18 24Z" fill="url(#mascot-heart-fill)" stroke="#ffb2cd" stroke-width="1.2"/><path d="M11 19c-.6-4 1.8-7 5-7" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2.4" stroke-linecap="round"/><path class="heart-sparkle" d="m40 2 1.7 4.3L46 8l-4.3 1.7L40 14l-1.7-4.3L34 8l4.3-1.7Z" fill="#fff1b0"/></svg>';
const sparkleSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1c1 6.5 4.5 10 11 11-6.5 1-10 4.5-11 11-1-6.5-4.5-10-11-11 6.5-1 10-4.5 11-11Z"/></svg>';

function decoration(mascot, className, html) {
  const node = document.createElement('span');
  node.className = className;
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = html;
  mascot.append(node);
  return node;
}

// Salto con anticipación, estiramiento y aterrizaje; la sombra del piso acompaña.
function hop(tl, image, shadow, at, height) {
  tl.to(image, { scaleX: 1.05, scaleY: .93, y: 3, duration: .12, ease: 'power2.out' }, at)
    .to(shadow, { scaleX: 1.08, opacity: .9, duration: .12, ease: 'power2.out' }, at)
    .to(image, { scaleX: .96, scaleY: 1.06, y: -height, duration: .26, ease: 'power3.out' }, at + .12)
    .to(shadow, { scaleX: .7, opacity: .45, duration: .26, ease: 'power3.out' }, at + .12)
    .to(image, { scaleX: 1, scaleY: 1, y: 0, duration: .22, ease: 'power2.in' }, at + .38)
    .to(shadow, { scaleX: 1, opacity: .75, duration: .22, ease: 'power2.in' }, at + .38)
    .to(image, { scaleX: 1.04, scaleY: .96, duration: .08, ease: 'power1.out' }, at + .6)
    .to(image, { scaleX: 1, scaleY: 1, duration: .3, ease: 'power3.out' }, at + .68);
}

export function showMascotFeedback(event, completedTasks) {
  const text = getMascotFeedbackMessage(event, completedTasks);
  if (text) play(text, event === 'sale' ? 'sale' : event === 'task' ? 'task' : 'talk');
}

// Frase libre de Topitín al tocarlo: 'talk' da un saltito, 'tickle' se retuerce de risa.
export function showMascotLine(text, variant = 'talk') {
  play(text, variant);
}

function play(text, variant) {
  clearMascotFeedback();
  const mascot = document.querySelector('.advisor-hero-mascot');
  if (!mascot) return;
  const sale = variant === 'sale';
  bubble = document.createElement('span');
  bubble.className = `mascot-feedback${sale ? ' mascot-feedback-sale' : ''}`;
  bubble.textContent = text;
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-live', 'polite');
  mascot.append(bubble);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    animation = gsap.context(() => {
      const image = mascot.querySelector('img');
      const shadow = decoration(mascot, 'mascot-feedback-shadow', '');
      // La sombra va bajo los pies reales de la imagen, no al fondo del contenedor.
      shadow.style.top = `${image.offsetTop + image.offsetHeight - 20}px`;
      shadow.style.bottom = 'auto';
      gsap.set(image, { transformOrigin: '50% 100%' });
      const body = gsap.timeline({ onComplete: () => gsap.set(image, { clearProps: 'transform' }) });
      body.fromTo(shadow, { opacity: 0, scaleX: .8, xPercent: -50 }, { opacity: .75, scaleX: 1, duration: .15 }, 0);
      if (variant === 'tickle') {
        // Cosquillas: se encoge de risa y se sacude rápido de lado a lado.
        body.to(image, { scaleY: .95, scaleX: 1.04, duration: .1, ease: 'power2.out' }, 0)
          .to(image, { rotation: -7, x: -4, duration: .07, ease: 'sine.inOut', repeat: 7, yoyo: true }, .08)
          .to(image, { rotation: 0, x: 0, scaleX: 1, scaleY: 1, duration: .25, ease: 'power3.out' }, .65);
      } else hop(body, image, shadow, 0, sale ? 24 : variant === 'task' ? 16 : 10);
      if (sale) {
        hop(body, image, shadow, .95, 14);
        body.to(image, { rotation: -4, duration: .14, ease: 'sine.inOut' }, 1.95)
          .to(image, { rotation: 3, duration: .18, ease: 'sine.inOut' }, 2.09)
          .to(image, { rotation: 0, duration: .2, ease: 'sine.out' }, 2.27);
      }
      body.to(shadow, { opacity: 0, duration: .3 }, sale ? 2.6 : 1.4);
      gsap.timeline()
        .fromTo(bubble, { autoAlpha: 0, y: 10, scale: .86, rotation: -3 }, { autoAlpha: 1, y: 0, scale: 1, rotation: 0, duration: .38, ease: 'back.out(1.7)' }, .1)
        .to(bubble, { y: -3, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: 1 }, .5)
        .to(bubble, { autoAlpha: 0, y: -8, duration: .22, ease: 'power2.in' }, 2.9);
      if (sale) {
        // Destellos que salen de la cabeza de Topitín: celebran sin tapar la pantalla.
        for (let index = 0; index < 7; index++) {
          const star = decoration(mascot, 'mascot-feedback-star', sparkleSvg);
          const angle = -Math.PI / 2 + (index - 3) * .42;
          const distance = 70 + (index % 3) * 18;
          gsap.timeline({ delay: .32 + index * .04, onComplete: () => star.remove() })
            .fromTo(star, { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 0, rotation: 0, autoAlpha: 1 }, { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, scale: .6 + (index % 3) * .25, rotation: 120, duration: .6, ease: 'power3.out' })
            .to(star, { autoAlpha: 0, scale: .2, duration: .35, ease: 'power2.in' }, '-=.1');
        }
      } else if (variant === 'task') {
        const heart = decoration(mascot, 'mascot-feedback-heart', heartSvg);
        gsap.timeline({ delay: .2, onComplete: () => heart.remove() })
          .fromTo(heart, { autoAlpha: 0, xPercent: -50, x: 0, y: 8, scale: .7, rotation: -10 }, { autoAlpha: 1, x: -6, y: -14, scale: 1, rotation: 4, duration: .3, ease: 'back.out(1.6)' })
          .to(heart, { x: 16, y: -104, autoAlpha: 0, scale: .85, rotation: 10, duration: .95, ease: 'power2.out' });
        gsap.fromTo(heart.querySelector('.heart-sparkle'), { opacity: 0, scale: .75, transformOrigin: 'center' }, { opacity: 1, scale: 1, duration: .25, delay: .35, repeat: 1, yoyo: true });
      }
    }, mascot);
  }
  dismissTimer = window.setTimeout(clearMascotFeedback, 3300);
}
