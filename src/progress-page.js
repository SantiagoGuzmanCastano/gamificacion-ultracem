import './progress.css';
import { gsap } from 'gsap';
import { advisorIcon } from './advisor-icons.js';
export { getProgressModel } from './progress-model.js';

const money = value => `$ ${Math.round(Number(value) || 0).toLocaleString('es-CO')}`;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function iconNode(name, className) {
  const node = element('span', className);
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = advisorIcon(name);
  return node;
}

export function showLevelBanner(world, level, reducedMotion = false) {
  const banner = element('div', 'progress-banner');
  banner.setAttribute('role', 'status');
  banner.append(element('strong', '', `¡Nivel ${level.level}!`), element('span', '', level.name));
  world.append(banner);
  if (reducedMotion) { setTimeout(() => banner.remove(), 3000); return; }
  gsap.timeline({ onComplete: () => banner.remove() })
    .from(banner, { scale: 0, rotation: -8, duration: .5, ease: 'back.out(2.5)' })
    .to(banner, { scale: 0, opacity: 0, duration: .3, delay: 2.4, ease: 'back.in(2)' });
}

export function renderProgressPage(page, model, { selected = model.level, onSelect = () => {}, onClients = () => {}, onReplay = null, onGuide = null, guideMascot = '' } = {}) {
  page.className = 'advisor-page progress-page';
  const heading = element('header', 'progress-heading');
  const copy = element('div');
  copy.append(element('h1', '', 'Tu progreso'), element('p', '', 'Cada venta confirmada hace crecer tu planta. Desbloquea nuevas islas y recompensas.'));
  // Bajo el título, pequeños y juntos: la guía y «Repetir celebración».
  const tools = element('div', 'progress-guide-row');
  if (onGuide) {
    const guide = element('button', 'advisor-guide-button progress-guide-open', '¿Cómo funciona esta pantalla?');
    guide.type = 'button';
    if (guideMascot) {
      const buddy = element('img', 'advisor-guide-mascot');
      buddy.src = guideMascot; buddy.alt = ''; buddy.width = 26; buddy.height = 26;
      guide.prepend(buddy);
    }
    guide.addEventListener('click', onGuide);
    tools.append(guide);
  }
  if (onReplay && model.level > 1) {
    const replay = element('button', 'progress-replay-small', 'Repetir celebración');
    replay.type = 'button';
    replay.prepend(iconNode('sparkles', 'progress-replay-icon'));
    replay.addEventListener('click', onReplay);
    tools.append(replay);
  }
  if (tools.childElementCount) copy.append(tools);
  heading.append(copy);

  const layout = element('div', 'progress-layout');
  const world = element('section', 'progress-world');
  world.setAttribute('aria-label', 'Mapa de tus niveles');
  const stage = element('div', 'progress-stage');
  const labels = element('div', 'progress-labels');
  const status = element('p', 'progress-world-status', 'Construyendo tu mundo…');
  status.setAttribute('role', 'status');
  world.append(stage, labels, status);

  const labelButtons = new Map();
  for (const level of model.levels) {
    const label = element('button', `progress-label is-${level.state}`);
    label.type = 'button';
    label.dataset.level = level.level;
    label.setAttribute('aria-label', `Nivel ${level.level}: ${level.name}. ${level.state === 'completed' ? 'Completado' : level.state === 'current' ? 'Nivel actual' : 'Bloqueado'}`);
    const text = element('span', '', String(level.level));
    text.prepend(element('span', 'progress-label-word', 'Nivel '));
    label.append(iconNode(level.state === 'locked' ? 'lock' : level.state === 'completed' ? 'check' : 'flag', 'progress-label-icon'), text);
    // Solo el siguiente nivel muestra, en chiquito, cuántas ventas faltan.
    if (model.next && level.level === model.next.level && model.remaining > 0) {
      const missing = model.remaining === 1 ? 'Falta 1 venta' : `Faltan ${model.remaining} ventas`;
      label.append(element('small', 'progress-label-hint', missing));
      label.setAttribute('aria-label', `${label.getAttribute('aria-label')}. ${missing}`);
    }
    label.addEventListener('click', () => onSelect(level.level));
    labels.append(label);
    labelButtons.set(level.level, label);
  }

  const side = element('aside', 'progress-side');
  side.setAttribute('aria-label', 'Detalle de tu progreso');

  // Tarjeta principal: nivel, una barra por segmentos (uno por venta), lo que falta y su recompensa.
  const currentCard = element('section', 'progress-card progress-current');
  const currentTop = element('div', 'progress-current-top');
  const currentCopy = element('div');
  currentCopy.append(element('span', 'progress-eyebrow', 'Tu nivel actual'), element('h2', '', `Nivel ${model.level}`), element('p', 'progress-current-name', model.current.name));
  const emblem = element('span', 'progress-emblem');
  emblem.setAttribute('aria-hidden', 'true');
  emblem.innerHTML = `<svg viewBox="0 0 64 64"><path d="M32 4 56 18v28L32 60 8 46V18Z"/></svg><strong>${model.level}</strong>`;
  currentTop.append(currentCopy, emblem);
  const goal = model.next ? model.next.minSales : model.sales;
  const segments = element('div', 'progress-segments');
  segments.setAttribute('role', 'progressbar');
  segments.setAttribute('aria-label', model.next ? `Ventas confirmadas hacia el nivel ${model.next.level}` : 'Nivel máximo');
  segments.setAttribute('aria-valuemin', '0');
  segments.setAttribute('aria-valuemax', String(Math.max(goal, 1)));
  segments.setAttribute('aria-valuenow', String(Math.min(model.sales, Math.max(goal, 1))));
  for (let index = 0; index < Math.max(goal, 1); index++) segments.append(element('span', index < model.sales || !model.next ? 'is-filled' : ''));
  const count = element('p', 'progress-meter-copy');
  if (model.next) count.append(element('strong', '', `${model.sales} de ${model.next.minSales}`), ' ventas confirmadas');
  else count.append(element('strong', '', plural(model.sales, 'venta confirmada', 'ventas confirmadas')), ' · ¡Llegaste a la cima!');
  currentCard.append(currentTop, segments, count);
  if (model.next) {
    const goalRow = element('div', 'progress-goal');
    const goalCopy = element('p', 'progress-goal-copy');
    goalCopy.append('Te ', element('strong', '', model.remaining === 1 ? 'falta 1 venta' : `faltan ${model.remaining} ventas`), ` para el Nivel ${model.next.level}`);
    const prize = element('span', 'progress-goal-prize');
    prize.append(iconNode('gift', 'progress-goal-icon'), element('strong', '', money(model.next.reward)));
    goalRow.append(goalCopy, prize);
    const cta = element('button', 'progress-cta', 'Ir a mis clientes');
    cta.type = 'button';
    cta.append(iconNode('arrow', 'progress-cta-icon'));
    cta.addEventListener('click', onClients);
    currentCard.append(goalRow, cta);
  } else {
    currentCard.append(element('p', 'progress-next-copy', 'Eres Maestro comercial. Sigue vendiendo para defender tu lugar en el ranking.'));
  }

  // Lo alcanzado hasta hoy, con la aclaración de que son metas del programa.
  const reached = model.levels.filter(level => level.state !== 'locked');
  const rewardCard = element('section', 'progress-card progress-reward');
  const rewardRow = element('div', 'progress-reward-row');
  const rewardValue = element('div');
  rewardValue.append(element('span', 'progress-card-title', 'Recompensas desbloqueadas'), element('strong', 'progress-money', money(reached.reduce((total, level) => total + Number(level.reward || 0), 0))), element('span', 'progress-reward-caption', reached.length === 1 ? 'Nivel 1' : `Niveles 1 a ${reached.length}`));
  rewardRow.append(iconNode('coins', 'progress-reward-icon'), rewardValue);
  rewardCard.append(rewardRow, element('p', 'progress-footnote', 'Son metas del programa: se muestran aquí y no se suman automáticamente a tu cartera.'));

  // Camino de niveles: línea de tiempo con las ventas que pide cada nivel y su estado.
  const listCard = element('section', 'progress-card progress-levels');
  listCard.append(element('h2', 'progress-card-title', 'Camino de niveles'));
  const list = element('ol', 'progress-level-list');
  const rowButtons = new Map();
  for (const level of model.levels) {
    const item = element('li', `is-${level.state}`);
    const row = element('button', `progress-level-row is-${level.state}`);
    row.type = 'button';
    row.dataset.level = level.level;
    const dot = element('span', 'progress-level-dot');
    dot.setAttribute('aria-hidden', 'true');
    if (level.state !== 'current') dot.innerHTML = advisorIcon(level.state === 'locked' ? 'lock' : 'check');
    const name = element('span', 'progress-level-name');
    const requirement = level.minSales ? plural(level.minSales, 'venta', 'ventas') : 'Al empezar';
    name.append(element('strong', '', `Nivel ${level.level}`), element('small', '', `${requirement} · ${level.name}`));
    const isNext = model.next && level.level === model.next.level;
    const state = level.state === 'completed' ? 'Desbloqueada' : level.state === 'current' ? 'Tu nivel' : isNext ? (model.remaining === 1 ? 'Falta 1 venta' : `Faltan ${model.remaining} ventas`) : 'Bloqueado';
    const reward = element('span', 'progress-level-reward');
    reward.append(element('strong', '', money(level.reward)), element('small', `progress-level-state${isNext ? ' is-next' : ''}`, state));
    row.append(dot, name, reward);
    row.addEventListener('click', () => onSelect(level.level));
    item.append(row);
    list.append(item);
    rowButtons.set(level.level, row);
  }
  listCard.append(list);

  side.append(currentCard, rewardCard, listCard);
  layout.append(world, side);
  page.replaceChildren(heading, layout);

  // El camino muestra tres niveles a la vez (último desbloqueado, actual y siguiente) y se desplaza.
  const items = [...list.children];
  const scrollToLevel = (level, behavior = 'auto') => {
    const index = model.levels.findIndex(item => item.level === level);
    const first = Math.max(0, Math.min(index - 1, items.length - 3));
    list.scrollTo({ top: items[first].offsetTop, behavior });
  };
  const fitWindow = () => {
    if (!list.isConnected || items.length < 3) return;
    const last = items[Math.min(2, items.length - 1)];
    list.style.maxHeight = `${last.offsetTop + last.offsetHeight}px`;
    scrollToLevel(model.level);
  };
  requestAnimationFrame(fitWindow);
  const select = (level, fromUser = true) => {
    for (const [id, row] of rowButtons) row.setAttribute('aria-pressed', String(id === level));
    for (const [id, label] of labelButtons) label.classList.toggle('is-selected', id === level);
    if (fromUser && list.isConnected) scrollToLevel(level, globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  };
  select(selected, false);
  return { stage, labels: labelButtons, status, select };
}

// Entrada de Progreso con GSAP: una vez por visita (los refrescos de datos no la repiten).
let progressEntered = false;
let progressEntrance = null;

export function resetProgressEntrance() {
  progressEntrance?.revert();
  progressEntrance = null;
  progressEntered = false;
}

export function playProgressEntrance(page) {
  if (progressEntered) return;
  progressEntered = true;
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true) return;
  const q = selector => page.querySelectorAll(selector);
  progressEntrance = gsap.context(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => gsap.set(q('.progress-heading *, .progress-world, .progress-side *'), { clearProps: 'transform,opacity' }) });
    tl.from(q('.progress-heading h1, .progress-heading p'), { opacity: 0, y: -14, duration: .45, stagger: .08 }, 0);
    tl.from(q('.progress-world'), { opacity: 0, y: 24, scale: .985, duration: .7 }, .1);
    tl.from(q('.progress-side > .progress-card'), { opacity: 0, x: 24, duration: .55, stagger: .1 }, .25);
    tl.from(q('.progress-emblem'), { scale: 0, rotation: -120, duration: .7, ease: 'back.out(1.8)' }, .5);
    tl.from(q('.progress-segments span'), { scaleX: 0, transformOrigin: '0 50%', duration: .35, stagger: .06, ease: 'power2.out' }, .6);
    tl.from(q('.progress-reward-icon, .progress-goal-icon'), { scale: .4, rotation: -30, duration: .55, stagger: .1, ease: 'back.out(2)' }, .65);
    tl.from(q('.progress-cta'), { opacity: 0, y: 8, duration: .4 }, .85);
    tl.from(q('.progress-level-row'), { opacity: 0, x: -12, duration: .35, stagger: .05 }, .8);
  }, page);
}
