import './topitin-guide.css';

// Guía de Topitín para cada tarea comercial: un saludo que se escribe letra por letra,
// pasos concretos que aparecen después y, si se pide, una idea extra de la IA.
const tons = client => {
  const value = Number(client.tons_requested || 0);
  return value ? `${value.toLocaleString('es-CO')} ${value === 1 ? 'tonelada' : 'toneladas'}` : '';
};

const guides = {
  'Preparar una visita': client => ({
    intro: `¡Vamos a preparar la visita a ${client.name}! Llegar con todo listo hace que la conversación fluya.`,
    steps: [
      `Repasa qué necesita el cliente${tons(client) ? ` y su pedido de ${tons(client)}` : ''}.`,
      'Lleva las fichas técnicas del cemento Ultracem y los precios vigentes.',
      'Agenda la hora y confirma quién toma la decisión de compra.',
    ],
    tip: 'Abre con una pregunta: «¿Qué obra tienen en camino?»',
  }),
  'Contactar al cliente': client => ({
    intro: `¡Hora de hablar con ${client.name}! Un contacto corto y claro deja la puerta abierta.`,
    steps: [
      'Llama o escribe por WhatsApp en horario laboral.',
      `Preséntate y recuerda el motivo${tons(client) ? `: su pedido de ${tons(client)}` : ''}.`,
      'Antes de colgar, acuerda una fecha para el siguiente paso.',
    ],
    tip: 'Anota en una línea lo que te dijo: te servirá para la cotización.',
  }),
  'Revisar una cotización': client => ({
    intro: `Revisemos la cotización de ${client.name} para que no haya sorpresas.`,
    steps: [
      `Confirma toneladas${tons(client) ? ` (${tons(client)})` : ''}, tipo de cemento y lugar de entrega.`,
      'Verifica precio, flete y tiempos de despacho.',
      'Envíala y llama al día siguiente para resolver dudas.',
    ],
    tip: 'Si duda por el precio, recuérdale el valor: calidad y despacho a tiempo.',
  }),
  'Planear el siguiente paso': client => ({
    intro: `¡Ya casi! Definamos cómo cerrar con ${client.name}.`,
    steps: [
      'Anota las dudas u objeciones que quedaron abiertas.',
      'Fija una fecha de cierre y quién confirma la compra.',
      'Cuando esté todo listo, completa la tarea y confirma la venta.',
    ],
    tip: 'Cada venta confirmada te suma 100 puntos y hace crecer tu planta.',
  }),
};

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

function make(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// Escribe el texto letra por letra; un clic en la burbuja lo completa de una vez.
function typeInto(node, text, bubble) {
  return new Promise(resolve => {
    if (reducedMotion()) { node.textContent = text; resolve(); return; }
    let index = 0, timer = null;
    const finish = () => { window.clearInterval(timer); node.textContent = text; bubble.classList.remove('is-typing'); bubble.removeEventListener('click', finish); resolve(); };
    bubble.classList.add('is-typing');
    bubble.addEventListener('click', finish);
    timer = window.setInterval(() => {
      index += 1;
      node.textContent = text.slice(0, index);
      if (index >= text.length) finish();
    }, 22);
  });
}

export function openTopitinGuide({ task, client, mascot, onAskAI = null }) {
  document.querySelector('.topitin-guide')?.remove();
  const guide = (guides[task.title] ?? (() => ({ intro: `Te ayudo con «${task.title}».`, steps: [task.description].filter(Boolean), tip: '' })))(client);
  const dialog = make('dialog', 'topitin-guide');
  dialog.setAttribute('aria-labelledby', 'topitin-guide-title');
  const close = make('button', 'topitin-guide-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Cerrar guía');
  close.addEventListener('click', () => dialog.close());

  const stage = make('div', 'topitin-guide-stage');
  const mascotWrap = make('div', 'topitin-guide-mascot');
  const image = make('img');
  image.src = mascot; image.alt = ''; image.width = 120; image.height = 150;
  mascotWrap.append(image, make('span', 'topitin-guide-shadow'));
  const bubble = make('div', 'topitin-guide-bubble');
  const speaker = make('span', 'topitin-guide-speaker', 'Topitín');
  const text = make('p', 'topitin-guide-text');
  text.setAttribute('aria-hidden', 'true');
  // El texto completo va oculto para lectores de pantalla, sin anunciar cada letra.
  const spoken = make('p', 'topitin-guide-sr', guide.intro);
  const dots = make('span', 'topitin-guide-dots');
  dots.append(make('i'), make('i'), make('i'));
  bubble.append(speaker, text, spoken, dots);
  stage.append(mascotWrap, bubble);

  const title = make('h2', '', task.title);
  title.id = 'topitin-guide-title';
  const head = make('header', 'topitin-guide-head');
  head.append(make('span', 'topitin-guide-eyebrow', `Guía para ${client.name}`), title);
  const steps = make('ol', 'topitin-guide-steps');
  guide.steps.forEach((step, index) => {
    const item = make('li');
    item.append(make('span', 'topitin-guide-step-number', String(index + 1)), make('span', '', step));
    steps.append(item);
  });
  const tip = guide.tip ? make('p', 'topitin-guide-tip') : null;
  if (tip) tip.append(make('strong', '', 'Tip: '), guide.tip);

  const extra = make('div', 'topitin-guide-extra');
  extra.setAttribute('role', 'status');
  extra.setAttribute('aria-live', 'polite');
  const actions = make('div', 'topitin-guide-actions');
  const done = make('button', 'topitin-guide-done', '¡Listo, a trabajar!');
  done.type = 'button';
  done.addEventListener('click', () => dialog.close());
  if (onAskAI) {
    const ask = make('button', 'topitin-guide-ask', 'Pedirle otra idea');
    ask.type = 'button';
    ask.addEventListener('click', async () => {
      ask.disabled = true; ask.textContent = 'Pensando…';
      mascotWrap.classList.add('is-thinking');
      extra.replaceChildren();
      try {
        const idea = await onAskAI();
        if (!dialog.isConnected) return;
        const ideaText = make('p', 'topitin-guide-idea');
        extra.append(ideaText);
        mascotWrap.classList.remove('is-thinking');
        hop();
        await typeInto(ideaText, idea, extra);
      } catch (cause) {
        if (dialog.isConnected) extra.append(make('p', 'topitin-guide-error', cause.message || 'No pude pensar una idea ahora. Intenta de nuevo.'));
      } finally {
        if (dialog.isConnected) { mascotWrap.classList.remove('is-thinking'); ask.disabled = false; ask.textContent = 'Pedirle otra idea'; }
      }
    });
    actions.append(ask);
  }
  actions.append(done);
  const body = make('div', 'topitin-guide-body');
  body.append(steps);
  if (tip) body.append(tip);
  body.append(extra);
  dialog.append(close, head, stage, body, actions);

  const hop = () => {
    mascotWrap.classList.remove('is-hopping');
    void mascotWrap.offsetWidth;
    mascotWrap.classList.add('is-hopping');
  };
  mascotWrap.addEventListener('animationend', event => { if (event.animationName === 'topitin-hop') mascotWrap.classList.remove('is-hopping'); });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  done.focus({ preventScroll: true });

  // Topitín entra saltando, "piensa" un instante, escribe y luego aparecen los pasos.
  window.setTimeout(async () => {
    if (!dialog.isConnected) return;
    await typeInto(text, guide.intro, bubble);
    if (!dialog.isConnected) return;
    hop();
    dialog.classList.add('show-steps');
  }, reducedMotion() ? 0 : 650);
  return dialog;
}
