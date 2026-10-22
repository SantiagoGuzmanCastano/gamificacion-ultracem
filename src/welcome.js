// Pantalla de bienvenida inmersiva: mensaje letra a letra, Topitín saludando y panel "Tareas del día".
// Spec: tests/welcome.spec.js. La estructura y la visibilidad viven aquí; la animación GSAP vive en
// welcome-motion.js (welcomeSequence / welcomeExit).
import './welcome.css';

export const WELCOME_STAGES = ['intro', 'mascot', 'tasks', 'done'];

export function getWelcomeTasks(clients = []) {
  return clients.flatMap(client => (client.tasks ?? [])
    .filter(task => !task.completed)
    .map(task => ({ id: task.id, title: task.title, clientName: client.name })));
}

// Se muestra una vez al día por dispositivo.
export function welcomeDayKey(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function shouldShowWelcome(lastShownDay, today) {
  return lastShownDay !== today;
}

function el(tag, className = '', value = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = value;
  return node;
}

function messageFor(name) {
  return `${name ? `¡Hola, ${name}!` : '¡Hola!'} Estas son tus tareas de hoy.`;
}

function messageHeading(text) {
  const heading = el('h1', 'welcome-message');
  heading.id = 'welcome-message';
  heading.dataset.testid = 'welcome-message';
  heading.setAttribute('aria-label', text);
  text.split(' ').forEach((word, index) => {
    if (index) heading.append(' ');
    const wordNode = el('span', 'welcome-word');
    wordNode.setAttribute('aria-hidden', 'true');
    for (const char of word) wordNode.append(el('span', 'welcome-char', char));
    heading.append(wordNode);
  });
  return heading;
}

function taskPanel(tasks) {
  const panel = el('section', 'welcome-tasks');
  panel.dataset.testid = 'welcome-tasks';
  panel.append(el('h2', '', 'Tareas del día'));
  if (!tasks.length) {
    panel.append(el('p', 'welcome-empty', 'No tienes tareas pendientes hoy.'));
    return panel;
  }
  const list = el('ul', 'welcome-task-list');
  for (const task of tasks) {
    const item = el('li', 'welcome-task');
    item.dataset.testid = 'welcome-task';
    item.dataset.taskId = task.id;
    item.append(el('strong', '', task.title), el('span', 'welcome-task-client', task.clientName));
    list.append(item);
  }
  panel.append(list);
  return panel;
}

export function createWelcome(container, { name = '', tasks = [], mascotSrc = '/mascot/pinguino-feliz.png', onClose = () => {} } = {}) {
  const element = el('section', 'welcome');
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  const heading = messageHeading(messageFor(name));
  element.setAttribute('aria-labelledby', heading.id);

  const mascot = el('div', 'welcome-mascot');
  mascot.dataset.testid = 'welcome-mascot';
  const figure = el('div', 'welcome-mascot-figure');
  figure.setAttribute('role', 'img');
  figure.setAttribute('aria-label', 'Mascota dando la bienvenida');
  const image = el('img', 'welcome-mascot-image');
  image.src = mascotSrc;
  image.alt = '';
  figure.append(image);
  mascot.append(figure, el('span', 'welcome-bubble', '¡Bienvenido!'));

  const panel = taskPanel(tasks);
  const close = el('button', 'primary welcome-close', 'Ir a mi tablero');
  close.type = 'button';
  close.dataset.testid = 'welcome-close';
  panel.append(close);

  // Fase 1 (vuelo falso 3D): capas planas detrás del contenido; welcome-motion.js las anima.
  const layers = el('div', 'welcome-layers');
  layers.dataset.testid = 'welcome-layers';
  layers.setAttribute('aria-hidden', 'true');
  for (const depth of ['back', 'mid', 'front']) {
    const layer = el('div', `welcome-layer welcome-layer-${depth}`);
    layer.dataset.layer = depth;
    layers.append(layer);
  }

  const stage = el('div', 'welcome-stage');
  stage.append(mascot, panel);
  element.append(layers, heading, stage);
  container.append(element);

  let closed = false;
  const onKey = event => { if (event.key === 'Escape') finish(); };
  function finish() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    onClose();
  }
  close.addEventListener('click', finish);
  document.addEventListener('keydown', onKey);

  // Desde qué etapa es visible cada parte.
  const parts = [[mascot, 'mascot'], [panel, 'tasks'], [close, 'done']];
  const welcome = {
    element,
    stage: 'intro',
    setStage(next) {
      const index = WELCOME_STAGES.indexOf(next);
      if (index < 0) throw new Error(`Etapa de bienvenida desconocida: ${next}`);
      welcome.stage = next;
      element.dataset.stage = next;
      for (const [node, from] of parts) {
        const shown = index >= WELCOME_STAGES.indexOf(from);
        node.hidden = !shown;
        node.dataset.visible = String(shown);
        node.setAttribute('aria-hidden', String(!shown));
      }
      if (next === 'done' && !closed) close.focus({ preventScroll: true });
    },
    // Con animate: false (movimiento reducido o tests) salta al final sin cargar GSAP.
    async play({ animate = true } = {}) {
      if (!animate) { welcome.setStage('done'); return; }
      const { welcomeSequence } = await import('./welcome-motion.js');
      await welcomeSequence(element, welcome.setStage);
    },
    close: finish,
  };
  welcome.setStage('intro');
  return welcome;
}
