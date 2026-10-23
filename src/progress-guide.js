import { gsap } from 'gsap';
import { advisorIcon } from './advisor-icons.js';

// Guía de Progreso con Topitín: tres pasos con una mini demostración que el asesor
// toca (sumar una venta, elegir una isla, abrir el cofre). Usa <dialog> nativo para
// el foco y Escape, y GSAP para las transiciones.
const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

function make(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function icon(name, className) {
  const node = make('span', className);
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = advisorIcon(name);
  return node;
}

const steps = [
  {
    title: 'Tu planta crece con cada venta',
    say: 'Cada venta confirmada suma a tu barra. ¡Prueba: toca «Sumar venta»!',
    done: '¡Así se hace! Al llenar la barra subes de nivel.',
    demo: (react) => {
      const box = make('div', 'pg-demo pg-demo-sales');
      const bar = make('div', 'pg-bar');
      const fill = make('span', 'pg-bar-fill');
      bar.append(fill);
      const label = make('span', 'pg-bar-label', '0 de 3 ventas');
      const add = make('button', 'pg-demo-button', 'Sumar venta');
      add.type = 'button';
      add.prepend(icon('check', 'pg-demo-button-icon'));
      let count = 0;
      add.addEventListener('click', () => {
        count = Math.min(3, count + 1);
        label.textContent = count === 3 ? '¡Nivel 2 desbloqueado!' : `${count} de 3 ventas`;
        if (reducedMotion()) fill.style.width = `${count / 3 * 100}%`;
        else gsap.to(fill, { width: `${count / 3 * 100}%`, duration: .5, ease: 'back.out(1.6)' });
        react(count === 3 ? 'done' : 'hop');
        if (count === 3) { add.disabled = true; box.classList.add('is-complete'); }
      });
      box.append(bar, label, add);
      return box;
    },
  },
  {
    title: 'Cada nivel es una isla',
    say: 'En el mapa cada isla es un nivel. Toca una para ver qué significa.',
    demo: (react, say) => {
      const box = make('div', 'pg-demo pg-demo-islands');
      const islands = [
        ['check', 'is-completed', 'Completada', '¡Esta ya es tuya! Las islas doradas son niveles que superaste.'],
        ['flag', 'is-current', 'Tu nivel', 'Aquí estás ahora. Tu planta crece en esta isla.'],
        ['lock', 'is-locked', 'Bloqueada', 'Esta sigue con candado: se abre con más ventas confirmadas.'],
      ];
      for (const [name, state, text, message] of islands) {
        const island = make('button', `pg-island ${state}`);
        island.type = 'button';
        island.append(icon(name, 'pg-island-icon'), make('span', '', text));
        island.addEventListener('click', () => {
          for (const other of box.querySelectorAll('.pg-island')) other.classList.toggle('is-picked', other === island);
          say(message);
          react('hop');
          if (!reducedMotion()) gsap.fromTo(island, { y: 0 }, { y: -10, duration: .18, yoyo: true, repeat: 1, ease: 'power2.out' });
        });
        box.append(island);
      }
      return box;
    },
  },
  {
    title: 'Desbloquea recompensas',
    say: 'Cada nivel trae un cofre con su recompensa. ¡Ábrelo!',
    done: 'Son metas del programa: se muestran aquí y no se suman solas a tu cartera.',
    demo: (react) => {
      const box = make('div', 'pg-demo pg-demo-chest');
      const chest = make('button', 'pg-chest');
      chest.type = 'button';
      chest.setAttribute('aria-label', 'Abrir el cofre');
      chest.append(icon('gift', 'pg-chest-icon'));
      const prize = make('strong', 'pg-chest-prize', '¡Recompensa desbloqueada!');
      chest.addEventListener('click', () => {
        chest.disabled = true;
        box.classList.add('is-open');
        react('done');
        if (reducedMotion()) return;
        gsap.timeline()
          .to(chest, { rotation: -8, duration: .08, yoyo: true, repeat: 3 })
          .to(chest, { scale: 1.08, duration: .2, ease: 'back.out(3)' })
          .fromTo(prize, { opacity: 0, y: 10, scale: .8 }, { opacity: 1, y: 0, scale: 1, duration: .4, ease: 'back.out(2)' }, '-=.1');
        for (let index = 0; index < 8; index++) {
          const coin = make('span', 'pg-coin');
          coin.setAttribute('aria-hidden', 'true');
          box.append(coin);
          const angle = (index / 8) * Math.PI * 2;
          gsap.fromTo(coin, { x: 0, y: 0, scale: .4, opacity: 1 }, { x: Math.cos(angle) * 70, y: Math.sin(angle) * 40 - 30, scale: 1, opacity: 0, duration: .9, delay: .35, ease: 'power2.out', onComplete: () => coin.remove() });
        }
      });
      box.append(chest, prize);
      return box;
    },
  },
];

export function showProgressGuide({ mascot }) {
  document.querySelector('.progress-guide')?.remove();
  const dialog = make('dialog', 'progress-guide');
  dialog.setAttribute('aria-labelledby', 'progress-guide-title');
  const close = make('button', 'progress-guide-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Cerrar instrucciones');
  close.addEventListener('click', () => dialog.close());

  const stage = make('div', 'progress-guide-stage');
  const buddy = make('img', 'progress-guide-mascot');
  buddy.src = mascot; buddy.alt = ''; buddy.width = 96; buddy.height = 120;
  const bubble = make('p', 'progress-guide-bubble');
  bubble.setAttribute('aria-live', 'polite');
  // El balanceo en reposo va en el contenedor; los saltos, en la imagen.
  const buddyWrap = make('span', 'progress-guide-buddy');
  buddyWrap.append(buddy);
  stage.append(buddyWrap, bubble);

  const counter = make('p', 'progress-guide-step');
  const title = make('h2', '', '');
  title.id = 'progress-guide-title';
  const demoSlot = make('div', 'progress-guide-demo-slot');
  const dots = make('div', 'progress-guide-dots');
  dots.setAttribute('aria-hidden', 'true');
  const actions = make('div', 'progress-guide-actions');
  const back = make('button', 'progress-guide-skip', 'Atrás');
  const next = make('button', 'progress-guide-next');
  back.type = next.type = 'button';
  actions.append(back, next);
  dialog.append(close, counter, title, stage, demoSlot, dots, actions);

  // Topitín habla con un pequeño rebote; «done» lo hace saltar y girar de alegría.
  const say = text => {
    bubble.textContent = text;
    if (!reducedMotion()) gsap.fromTo(bubble, { scale: .9, opacity: .3 }, { scale: 1, opacity: 1, duration: .35, ease: 'back.out(2)', overwrite: true });
  };
  const react = kind => {
    if (kind === 'done' && steps[index].done) say(steps[index].done);
    if (reducedMotion()) return;
    gsap.timeline()
      .to(buddy, { y: kind === 'done' ? -26 : -14, scaleY: 1.06, duration: .2, ease: 'power2.out' })
      .to(buddy, { rotation: kind === 'done' ? 360 : 0, duration: kind === 'done' ? .45 : 0, ease: 'power2.inOut' }, '<')
      .to(buddy, { y: 0, scaleY: 1, duration: .35, ease: 'bounce.out' })
      .set(buddy, { rotation: 0 });
  };

  let index = 0;
  const show = (direction = 1) => {
    const step = steps[index];
    counter.textContent = `Paso ${index + 1} de ${steps.length}`;
    title.textContent = step.title;
    say(step.say);
    const demo = step.demo(react, say);
    demoSlot.replaceChildren(demo);
    dots.replaceChildren(...steps.map((_, dot) => make('span', dot === index ? 'is-active' : '')));
    back.hidden = index === 0;
    next.textContent = index === steps.length - 1 ? '¡A vender!' : 'Siguiente';
    if (!reducedMotion()) {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        // fromTo con valores finales fijos: tocar «Siguiente» rápido no deja el título a medias.
        .fromTo([counter, title], { opacity: 0, x: 24 * direction }, { opacity: 1, x: 0, duration: .35, stagger: .05, overwrite: true })
        .from(demo, { opacity: 0, y: 16, scale: .96, duration: .45 }, .1)
        .from(demo.children, { opacity: 0, y: 10, duration: .3, stagger: .06 }, .2);
    }
  };
  back.addEventListener('click', () => { if (index > 0) { index--; show(-1); } });
  next.addEventListener('click', () => {
    if (index === steps.length - 1) { dialog.close(); return; }
    index++;
    show(1);
  });
  let idle = null;
  dialog.addEventListener('close', () => { idle?.kill(); gsap.killTweensOf(buddy); dialog.remove(); });
  document.body.append(dialog);
  dialog.showModal();
  show();
  next.focus({ preventScroll: true });
  if (!reducedMotion()) {
    gsap.timeline()
      .from(dialog, { opacity: 0, y: 30, scale: .95, duration: .45, ease: 'power3.out' })
      .from(buddy, { y: 80, opacity: 0, rotation: -15, duration: .7, ease: 'back.out(1.8)' }, .1);
    idle = gsap.to(buddyWrap, { y: -4, rotation: -2, duration: 1.3, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.2 });
  }
  return dialog;
}
