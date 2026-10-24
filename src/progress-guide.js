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

const progressSteps = [
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

// Inicio: qué es el sistema (un CRM en modo juego) y el camino cliente → tareas → venta,
// en el orden en que se trabaja, con mini demos para tocar.
const taskSteps = [['clients', 'Preparar una visita'], ['phone', 'Contactar al cliente'], ['document', 'Revisar una cotización'], ['target', 'Planear el siguiente paso']];

// Mini versión del panel «Clientes actuales pendientes» con clientes de ejemplo.
function clientsPreview(react, say) {
  const box = make('div', 'pg-demo pg-demo-window');
  const bar = make('div', 'pg-window-bar');
  bar.setAttribute('aria-hidden', 'true');
  bar.append(make('i'), make('i'), make('i'), make('span', '', 'Inicio · Clientes actuales pendientes'));
  const body = make('div', 'pg-window-body');
  const rail = make('div', 'pg-window-rail');
  const detail = make('div', 'pg-window-detail');
  detail.setAttribute('aria-live', 'polite');
  const sample = [
    { name: 'Ferretería El Roble', type: 'Ferretería', city: 'Medellín', tons: 30, done: 1 },
    { name: 'Constructora Andes', type: 'Constructora', city: 'Bogotá', tons: 120, done: 0 },
    { name: 'Depósito La Ceiba', type: 'Depósito', city: 'Cali', tons: 12, done: 3 },
  ];
  const paint = client => {
    const head = make('div', 'pg-window-head');
    head.append(make('span', 'pg-window-type', client.type), make('strong', '', client.name), make('span', 'pg-window-count', `${client.done}/4 completadas · ${client.tons} t`));
    const list = make('ol', 'pg-window-tasks');
    taskSteps.forEach(([name, title], index) => {
      const item = make('li', index < client.done ? 'is-done' : '');
      item.append(icon(name, 'pg-window-task-icon'), make('span', '', title), make('em', '', index < client.done ? 'Completado' : 'Pendiente'));
      list.append(item);
    });
    detail.replaceChildren(head, list);
  };
  for (const client of sample) {
    const option = make('button', 'pg-window-client');
    option.type = 'button';
    option.append(make('strong', '', client.name), make('span', '', `${client.city} · ${4 - client.done} ${client.done === 3 ? 'pendiente' : 'pendientes'}`));
    option.addEventListener('click', () => {
      for (const other of rail.children) {
        other.classList.toggle('is-selected', other === option);
        other.setAttribute('aria-pressed', String(other === option));
      }
      paint(client);
      say(`${client.name} pide ${client.tons} toneladas. ${client.done === 3 ? '¡Solo le falta 1 tarea para ser una venta!' : `Le faltan ${4 - client.done} tareas para convertirse en venta.`}`);
      react('hop');
      if (!reducedMotion()) gsap.from(detail.children, { opacity: 0, x: 10, duration: .3, stagger: .05, ease: 'power2.out' });
    });
    option.setAttribute('aria-pressed', 'false');
    rail.append(option);
  }
  rail.firstChild.classList.add('is-selected');
  rail.firstChild.setAttribute('aria-pressed', 'true');
  paint(sample[0]);
  body.append(rail, detail);
  box.append(bar, body, make('p', 'pg-window-hint', '¿Sin clientes? Toca «Solicitar un cliente» y el administrador te asigna uno.'));
  return box;
}

const dashboardSteps = [
  {
    title: '¡Hola, soy Topitín!',
    say: 'Esto es tu CRM de ventas en modo juego. Toca cada paso para ver cómo funciona.',
    done: 'Ese es todo el juego: clientes → tareas → venta → premios. ¡Te lo muestro!',
    demo: (react, say) => {
      const box = make('div', 'pg-demo pg-demo-flow');
      const seen = new Set();
      for (const [name, text, message] of [
        ['clients', 'Cliente', 'El administrador te asigna clientes. Cada uno simula una oportunidad de venta real.'],
        ['tasks', '4 tareas', 'Con cada cliente completas 4 tareas: son los pasos de una venta.'],
        ['check', 'Venta', 'Al terminar las 4 tareas confirmas la venta: ese cliente queda cerrado.'],
        ['gift', 'Premios', 'Cada venta te da puntos, comisión, niveles y te sube en el ranking.'],
      ]) {
        const node = make('button', 'pg-flow-step');
        node.type = 'button';
        node.append(icon(name, 'pg-island-icon'), make('span', '', text));
        node.addEventListener('click', () => {
          for (const other of box.children) other.classList.toggle('is-picked', other === node);
          node.classList.add('is-seen');
          seen.add(text);
          if (seen.size === 4) react('done');
          else { say(message); react('hop'); }
          if (!reducedMotion()) gsap.fromTo(node, { y: 0 }, { y: -8, duration: .16, yoyo: true, repeat: 1, ease: 'power2.out' });
        });
        box.append(node);
      }
      return box;
    },
  },
  {
    title: 'Tus clientes asignados',
    say: 'En «Clientes actuales pendientes» están los clientes que te asignaron. ¡Toca uno!',
    demo: clientsPreview,
  },
  {
    title: '4 tareas = 1 venta',
    say: 'Cada cliente trae estas 4 tareas, una por cada paso de una venta real. ¡Márcalas!',
    done: '¡Todo listo! Con las 4 hechas, ese cliente está listo para cerrar.',
    demo: (react) => {
      const box = make('div', 'pg-demo pg-demo-tasks');
      const list = make('div', 'pg-task-list');
      let done = 0;
      for (const [, title] of taskSteps) {
        const task = make('button', 'pg-task');
        task.type = 'button';
        task.append(icon('check', 'pg-task-check'), make('span', '', title));
        task.addEventListener('click', () => {
          if (task.classList.contains('is-done')) return;
          task.classList.add('is-done');
          task.setAttribute('aria-pressed', 'true');
          done += 1;
          if (!reducedMotion()) gsap.fromTo(task.querySelector('.pg-task-check'), { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: .45, ease: 'back.out(2.4)' });
          react(done === 4 ? 'done' : 'hop');
        });
        task.setAttribute('aria-pressed', 'false');
        list.append(task);
      }
      box.append(list);
      return box;
    },
  },
  {
    title: 'Confirma la venta',
    say: 'Con las 4 tareas hechas aparece «Confirmar venta». ¡Pruébalo!',
    done: '+100 puntos, tus toneladas suman a la meta y tu comisión llega a la cartera.',
    demo: (react) => {
      const box = make('div', 'pg-demo pg-demo-chest');
      const confirm = make('button', 'pg-demo-button', 'Confirmar venta');
      confirm.type = 'button';
      confirm.prepend(icon('check', 'pg-demo-button-icon'));
      const prize = make('strong', 'pg-chest-prize', '+100 puntos');
      confirm.addEventListener('click', () => {
        confirm.disabled = true;
        box.classList.add('is-open');
        react('done');
        if (reducedMotion()) return;
        gsap.fromTo(prize, { opacity: 0, y: 10, scale: .7 }, { opacity: 1, y: 0, scale: 1, duration: .45, ease: 'back.out(2.4)' });
        for (let index = 0; index < 8; index++) {
          const coin = make('span', 'pg-coin');
          coin.setAttribute('aria-hidden', 'true');
          box.append(coin);
          const angle = (index / 8) * Math.PI * 2;
          gsap.fromTo(coin, { x: 0, y: 0, scale: .4, opacity: 1 }, { x: Math.cos(angle) * 80, y: Math.sin(angle) * 40 - 20, scale: 1, opacity: 0, duration: .9, ease: 'power2.out', onComplete: () => coin.remove() });
        }
      });
      box.append(confirm, prize);
      return box;
    },
  },
  {
    title: 'Tu avance de un vistazo',
    say: 'Arriba del Inicio ves cómo vas. Toca el círculo y cada dato.',
    demo: (react, say) => {
      const box = make('div', 'pg-demo pg-demo-stats');
      const ring = make('button', 'pg-ring');
      ring.type = 'button';
      ring.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42"/><circle class="pg-ring-fill" cx="50" cy="50" r="42" pathLength="100" stroke-dasharray="50 100"/></svg>';
      ring.append(make('strong', '', '50%'), make('span', '', '2 de 4 tareas'));
      const chips = make('div', 'pg-stat-chips');
      const pick = (node, message) => {
        for (const other of box.querySelectorAll('.is-picked')) other.classList.remove('is-picked');
        node.classList.add('is-picked');
        say(message);
        react('hop');
      };
      ring.addEventListener('click', () => pick(ring, 'El círculo es el avance de las tareas de tus clientes actuales.'));
      for (const [name, text, message] of [
        ['flag', 'Nivel', 'Tu nivel sube con ventas confirmadas. Lo ves crecer en Progreso.'],
        ['flame', 'Racha', 'Los días seguidos que trabajas. ¡No la rompas!'],
        ['truck', 'Toneladas', 'Las toneladas de cemento que ya vendiste. Toca la tarjeta en Inicio y se voltea.'],
        ['trophy', 'Puesto', 'Tu lugar en el ranking de asesores.'],
      ]) {
        const chip = make('button', 'pg-stat-chip');
        chip.type = 'button';
        chip.append(icon(name, 'pg-stat-icon'), make('span', '', text));
        chip.addEventListener('click', () => pick(chip, message));
        chips.append(chip);
      }
      box.append(ring, chips);
      return box;
    },
  },
  {
    title: 'Ranking y meta del mes',
    say: 'Más abajo compites por ventas confirmadas y llenas tu meta mensual de toneladas.',
    demo: (react, say) => {
      const box = make('div', 'pg-demo pg-demo-podium');
      for (const [place, height, message] of [[2, 52, 'Plata: ¡muy cerca de la cima!'], [1, 74, '¡La corona es para quien más ventas confirma!'], [3, 38, 'Bronce: cada venta te sube un escalón.']]) {
        const step = make('button', `pg-podium-step is-${place}`);
        step.type = 'button';
        step.style.height = `${height}px`;
        step.append(make('span', '', String(place)));
        step.setAttribute('aria-label', `Puesto ${place}`);
        step.addEventListener('click', () => { say(message); react(place === 1 ? 'done' : 'hop'); });
        box.append(step);
      }
      if (!reducedMotion()) gsap.from(box.children, { scaleY: 0, transformOrigin: '50% 100%', duration: .6, stagger: .1, ease: 'back.out(1.6)', delay: .2 });
      return box;
    },
  },
  {
    title: 'Siempre estoy contigo',
    say: '¿No sabes cómo hacer una tarea? Toca «Pregunta a Topitín». ¡Pruébalo!',
    done: '¡Así! Te doy pasos concretos para esa tarea y, si quieres, una idea extra.',
    demo: (react) => {
      const box = make('div', 'pg-demo pg-demo-ask');
      const card = make('div', 'pg-ask-card');
      const copy = make('div', 'pg-ask-copy');
      copy.append(make('strong', '', 'Contactar al cliente'), make('span', '', 'Llama o escribe y acuerda el siguiente paso.'));
      const ask = make('button', 'pg-demo-button', 'Pregunta a Topitín');
      ask.type = 'button';
      ask.prepend(icon('sparkles', 'pg-demo-button-icon'));
      ask.addEventListener('click', () => { card.classList.add('is-asked'); react('done'); });
      card.append(icon('phone', 'pg-window-task-icon'), copy);
      box.append(card, ask);
      return box;
    },
  },
];

export function showProgressGuide({ mascot }) {
  return openGuide(progressSteps, { mascot });
}

export function showDashboardGuide({ mascot }) {
  return openGuide(dashboardSteps, { mascot, className: 'is-dashboard' });
}

function openGuide(steps, { mascot, className = '' }) {
  document.querySelector('.progress-guide')?.remove();
  const dialog = make('dialog', `progress-guide ${className}`.trim());
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
