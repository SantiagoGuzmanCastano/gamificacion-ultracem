// Intro de bienvenida v2 (animaciones.md §14): vuelo a través del logo oficial, "¡Hola, {nombre}!" letra
// por letra y Topitín saludando. Se cierra sola 1,5 s después de terminar, o con clic, toque o Esc.
// Spec: tests/welcome.spec.js. La estructura vive aquí; la animación GSAP, en welcome-motion.js.
import './welcome.css';

export const WELCOME_STAGES = ['intro', 'mascot', 'done'];
const AUTO_CLOSE_MS = 1500;
const LOGO_SRC = '/ultracem-logo.png';

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

// Capas planas del vuelo falso 3D; el frente lleva el logo oficial y es el que se atraviesa.
function flightLayers() {
  const layers = el('div', 'welcome-layers');
  layers.dataset.testid = 'welcome-layers';
  layers.setAttribute('aria-hidden', 'true');
  for (const depth of ['back', 'mid', 'front']) {
    const layer = el('div', `welcome-layer welcome-layer-${depth}`);
    layer.dataset.layer = depth;
    if (depth === 'front') {
      const logo = el('img', 'welcome-logo');
      logo.src = LOGO_SRC;
      logo.alt = '';
      layer.append(logo);
    }
    layers.append(layer);
  }
  return layers;
}

export function createWelcome(container, { name = '', mascotSrc = '/mascot/pinguino-feliz.png', onClose = () => {} } = {}) {
  const element = el('section', 'welcome');
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  const heading = messageHeading(name ? `¡Hola, ${name}!` : '¡Hola!');
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

  const hint = el('p', 'welcome-skip-hint sr-only', 'Toca o pulsa Esc para continuar');
  element.append(flightLayers(), heading, mascot, hint);
  container.append(element);

  let closed = false, timer = null;
  const onKey = event => { if (event.key === 'Escape') finish(); };
  function finish() {
    if (closed) return;
    closed = true;
    window.clearTimeout(timer);
    document.removeEventListener('keydown', onKey);
    onClose();
  }
  element.addEventListener('click', finish);
  document.addEventListener('keydown', onKey);

  const parts = [[mascot, 'mascot']];
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
    },
    // Con animate: false (movimiento reducido o tests) salta al final sin cargar GSAP.
    async play({ animate = true } = {}) {
      if (animate) {
        const { welcomeSequence } = await import('./welcome-motion.js');
        await welcomeSequence(element, welcome.setStage);
      }
      welcome.setStage('done');
      if (!closed) timer = window.setTimeout(finish, AUTO_CLOSE_MS);
    },
    close: finish,
  };
  welcome.setStage('intro');
  return welcome;
}
