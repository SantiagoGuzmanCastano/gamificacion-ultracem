import { gsap } from 'gsap';

// Relleno del espacio vacío de una tarjeta estirada en Inicio: frases de grandes figuras de las
// ventas y datos curiosos de Ultracem. Cambian cada 15 segundos y la frase se la lleva el viento,
// muy suave, mientras llega la siguiente. Discreto: no debe robar la atención.

// Frases conocidas de figuras de las ventas y los negocios (traducidas al español).
export const SALES_QUOTES = [
  { text: 'Tendrás todo lo que quieras en la vida si ayudas a suficientes personas a conseguir lo que ellas quieren.', author: 'Zig Ziglar' },
  { text: 'A la gente no le gusta que le vendan, pero le encanta comprar.', author: 'Jeffrey Gitomer' },
  { text: 'Harás más amigos en dos meses interesándote por los demás que en dos años intentando que se interesen por ti.', author: 'Dale Carnegie' },
  { text: 'Tus clientes más insatisfechos son tu mayor fuente de aprendizaje.', author: 'Bill Gates' },
  { text: 'El objetivo es conocer y entender tan bien al cliente que el producto se venda solo.', author: 'Peter Drucker' },
  { text: 'Imagina que cada persona que conoces lleva un letrero que dice: «Hazme sentir importante».', author: 'Mary Kay Ash' },
  { text: 'Solo hay un jefe: el cliente.', author: 'Sam Walton' },
  { text: 'Toda venta tiene cinco obstáculos: no hay necesidad, no hay dinero, no hay prisa, no hay deseo, no hay confianza.', author: 'Zig Ziglar' },
  { text: 'La gente no compra lo que haces, compra por qué lo haces.', author: 'Simon Sinek' },
  { text: 'La gente no compra bienes y servicios. Compra relaciones, historias y magia.', author: 'Seth Godin' },
  { text: 'Vemos a nuestros clientes como invitados a una fiesta, y nosotros somos los anfitriones.', author: 'Jeff Bezos' },
  { text: 'Toma 20 años construir una reputación y cinco minutos arruinarla.', author: 'Warren Buffett' },
  { text: 'La venta empieza cuando el cliente dice que no.', author: 'Elmer Letterman' },
];

// Datos públicos de Ultracem (Portafolio, 2026; El Heraldo, 2015).
export const ULTRACEM_FACTS = [
  'En 2015 Ultracem levantó en Galapa el primer domo de Colombia para almacenar materia prima: 90.000 toneladas.',
  'Ultracem fue la primera cementera del país con el Sello de Sostenibilidad de Icontec en categoría Platino.',
  'Ultracem es la primera empresa de América Latina con la certificación Basura Cero en categoría Oro.',
  'El cemento del nuevo puente Pumarejo, sobre el río Magdalena, es de Ultracem.',
  'En 2025 Ultracem despachó 1.250.000 toneladas de cemento en todas sus operaciones.',
];

// Baraja de Fisher-Yates: cada entrada a Inicio trae un orden distinto.
function shuffle(list, random) {
  for (let index = list.length - 1; index > 0; index--) {
    const pick = Math.floor(random() * (index + 1));
    [list[index], list[pick]] = [list[pick], list[index]];
  }
  return list;
}

// Mezcla al azar, pero siempre dos frases y un dato de Ultracem, para que no se repita el tipo seguido.
export function fillerMessages(random = Math.random) {
  const quotes = shuffle(SALES_QUOTES.map(quote => ({ kind: 'quote', ...quote })), random);
  const facts = shuffle(ULTRACEM_FACTS.map(text => ({ kind: 'fact', text })), random);
  const mixed = [];
  while (quotes.length || facts.length) mixed.push(...quotes.splice(0, 2), ...facts.splice(0, 1));
  return mixed;
}

const LABELS = { quote: 'Tip de venta', fact: 'Dato Ultracem' };
const ROTATE_MS = 15000;
const MIN_GAP = 120;
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

const fillers = new Map();

// Letras en cajitas para que el viento se las lleve una por una; las palabras no se parten.
function windText(text) {
  const line = document.createElement('span');
  line.className = 'filler-wind';
  text.split(' ').forEach((word, index) => {
    const box = document.createElement('span');
    box.className = 'filler-word';
    for (const char of word) {
      const letter = document.createElement('span');
      letter.className = 'filler-char';
      letter.textContent = char;
      box.append(letter);
    }
    line.append(box);
    if (index < text.split(' ').length - 1) line.append(' ');
  });
  return line;
}

function paint(filler, message) {
  const { quote, label } = filler.parts;
  label.textContent = LABELS[message.kind];
  const body = document.createElement('span');
  body.className = 'filler-body';
  body.append(windText(message.kind === 'quote' ? `«${message.text}»` : message.text));
  if (message.author) {
    const author = document.createElement('span');
    author.className = 'filler-author';
    author.textContent = `— ${message.author}`;
    body.append(author);
  }
  quote.replaceChildren(body);
  quote.dataset.kind = message.kind;
  filler.node.setAttribute('aria-label', `${LABELS[message.kind]}: ${message.text}${message.author ? `, ${message.author}` : ''}`);
  return body;
}

// Brisa suave hacia la derecha: cada letra, plana (sin girar), se corre un poco, sube apenas,
// se desenfoca y se apaga, despacio y en cascada.
function blowAway(body) {
  const chars = body.querySelectorAll('.filler-char, .filler-author');
  return gsap.to(chars, {
    x: () => gsap.utils.random(8, 22), y: () => gsap.utils.random(-8, -2),
    opacity: 0, filter: 'blur(3px)', duration: 1.6, ease: 'sine.in', stagger: { each: .018, from: 'start' },
  });
}
// La nueva frase llega igual de suave desde la izquierda y se aclara.
function condense(body) {
  return gsap.from(body.querySelectorAll('.filler-char, .filler-author'), {
    x: -10, y: 2, opacity: 0, filter: 'blur(3px)',
    duration: 1.4, ease: 'sine.out', stagger: { each: .014, from: 'start' }, clearProps: 'filter,transform',
  });
}

function next(filler) {
  if (!filler.node.isConnected) return stop(filler);
  if (filler.paused || document.hidden) return;
  filler.index = (filler.index + 1) % filler.messages.length;
  const old = filler.parts.quote.querySelector('.filler-body');
  const show = () => { const body = paint(filler, filler.messages[filler.index]); if (!reduced()) condense(body); };
  if (reduced() || !old) { show(); return; }
  blowAway(old).then(show);
}
function stop(filler) {
  clearInterval(filler.timer);
  fillers.delete(filler.card);
}

function createFiller(card, messages, start, mascot) {
  const node = document.createElement('aside');
  node.className = 'dashboard-filler';
  node.setAttribute('role', 'note');
  const head = document.createElement('span');
  head.className = 'filler-head';
  if (mascot) {
    const buddy = document.createElement('img');
    buddy.className = 'filler-mascot';
    buddy.src = mascot; buddy.alt = ''; buddy.width = 40; buddy.height = 40;
    head.append(buddy);
  }
  const label = document.createElement('span');
  label.className = 'filler-label';
  head.append(label);
  const quote = document.createElement('p');
  quote.className = 'filler-quote';
  node.append(head, quote);
  const filler = { card, node, messages, index: start, paused: false, parts: { label, quote } };
  // Se pausa al pasar el mouse para poder leerla con calma.
  node.addEventListener('pointerenter', () => { filler.paused = true; });
  node.addEventListener('pointerleave', () => { filler.paused = false; });
  paint(filler, messages[start]);
  filler.timer = setInterval(() => next(filler), ROTATE_MS);
  return filler;
}

// Pone o quita el relleno según el espacio vacío real de cada tarjeta (alto actual − alto natural).
export function syncFillers(cards, natural, { messages = [], mascot = '', enabled = true } = {}) {
  let offset = 0;
  for (const card of Object.values(cards)) {
    const empty = enabled ? card.offsetHeight - (natural[card.dataset.card] ?? card.offsetHeight) : 0;
    const current = fillers.get(card);
    if (empty < MIN_GAP || !messages.length) {
      if (current) { current.node.remove(); stop(current); }
      continue;
    }
    const filler = current ?? createFiller(card, messages, offset % messages.length, mascot);
    offset += 3;
    if (!current) {
      fillers.set(card, filler);
      card.append(filler.node);
      // La primera frase también llega con la brisa, igual que las siguientes.
      if (!reduced()) condense(filler.parts.quote.querySelector('.filler-body'));
    }
    filler.node.style.top = `${natural[card.dataset.card]}px`;
    filler.node.classList.toggle('is-roomy', empty >= 260);
  }
}

export function clearFillers() {
  for (const filler of fillers.values()) { filler.node.remove(); clearInterval(filler.timer); }
  fillers.clear();
}
