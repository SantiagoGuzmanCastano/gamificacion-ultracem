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

export function renderProgressPage(page, model, { selected = model.level, onSelect = () => {}, onClients = () => {}, onReplay = null } = {}) {
  page.className = 'advisor-page progress-page';
  const heading = element('header', 'progress-heading');
  const copy = element('div');
  copy.append(element('h1', '', 'Tu progreso'), element('p', '', 'Cada venta confirmada hace crecer tu planta. Desbloquea nuevas islas y recompensas.'));
  heading.append(copy);
  if (onReplay && model.level > 1) {
    const replay = element('button', 'progress-replay', 'Repetir celebración');
    replay.type = 'button';
    replay.prepend(iconNode('sparkles', 'progress-replay-icon'));
    replay.addEventListener('click', onReplay);
    heading.append(replay);
  }

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
    label.addEventListener('click', () => onSelect(level.level));
    labels.append(label);
    labelButtons.set(level.level, label);
  }

  const side = element('aside', 'progress-side');
  side.setAttribute('aria-label', 'Detalle de tu progreso');

  const currentCard = element('section', 'progress-card progress-current');
  const currentTop = element('div', 'progress-current-top');
  const currentCopy = element('div');
  currentCopy.append(element('span', 'progress-eyebrow', 'Tu nivel actual'), element('h2', '', `Nivel ${model.level}`), element('p', 'progress-current-name', model.current.name));
  const emblem = element('span', 'progress-emblem');
  emblem.setAttribute('aria-hidden', 'true');
  emblem.innerHTML = `<svg viewBox="0 0 64 64"><path d="M32 4 56 18v28L32 60 8 46V18Z"/></svg><strong>${model.level}</strong>`;
  currentTop.append(currentCopy, emblem);
  const meter = element('div', 'progress-meter');
  meter.setAttribute('role', 'progressbar');
  meter.setAttribute('aria-label', model.next ? `Avance hacia el nivel ${model.next.level}` : 'Nivel máximo');
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', '100');
  meter.setAttribute('aria-valuenow', String(model.percentage));
  const fill = element('span');
  fill.style.width = `${model.percentage}%`;
  meter.append(fill);
  const meterCopy = model.next
    ? `${model.sales} de ${model.next.minSales} ventas confirmadas para el nivel ${model.next.level}`
    : `${plural(model.sales, 'venta confirmada', 'ventas confirmadas')}. ¡Llegaste a la cima!`;
  currentCard.append(currentTop, meter, element('p', 'progress-meter-copy', meterCopy));

  const rewardCard = element('section', 'progress-card progress-reward');
  rewardCard.append(element('span', 'progress-card-title', `Recompensa del nivel ${model.level}`));
  const rewardRow = element('div', 'progress-reward-row');
  const rewardValue = element('div');
  rewardValue.append(element('strong', 'progress-money', money(model.current.reward)), element('span', 'progress-reward-caption', 'meta de recompensa'));
  rewardRow.append(iconNode('coins', 'progress-reward-icon'), rewardValue, element('span', 'progress-pill is-done', 'Desbloqueada'));
  rewardCard.append(rewardRow);

  const nextCard = element('section', 'progress-card progress-next');
  if (model.next) {
    nextCard.append(element('span', 'progress-card-title', 'Siguiente recompensa'));
    const nextRow = element('div', 'progress-reward-row');
    const nextValue = element('div');
    nextValue.append(element('strong', 'progress-money', money(model.next.reward)), element('span', 'progress-reward-caption', model.next.name));
    const lockPill = element('span', 'progress-pill is-locked', `Nivel ${model.next.level}`);
    lockPill.prepend(iconNode('lock', 'progress-pill-icon'));
    nextRow.append(iconNode('gift', 'progress-reward-icon is-locked'), nextValue, lockPill);
    const missing = element('p', 'progress-next-copy');
    missing.append('Te ', element('strong', '', model.remaining === 1 ? 'falta 1 venta confirmada' : `faltan ${model.remaining} ventas confirmadas`), ' para abrir el cofre.');
    const cta = element('button', 'progress-cta', 'Ir a mis clientes');
    cta.type = 'button';
    cta.append(iconNode('arrow', 'progress-cta-icon'));
    cta.addEventListener('click', onClients);
    nextCard.append(nextRow, missing, cta);
  } else {
    nextCard.append(element('span', 'progress-card-title', 'Todas las recompensas desbloqueadas'), element('p', 'progress-next-copy', 'Eres Maestro comercial. Sigue vendiendo para defender tu lugar en el ranking.'));
  }

  const listCard = element('section', 'progress-card progress-levels');
  listCard.append(element('h2', 'progress-card-title', 'Todos los niveles'));
  const list = element('ol', 'progress-level-list');
  const rowButtons = new Map();
  for (const level of model.levels) {
    const item = element('li');
    const row = element('button', `progress-level-row is-${level.state}`);
    row.type = 'button';
    row.dataset.level = level.level;
    const dot = element('span', 'progress-level-dot');
    dot.setAttribute('aria-hidden', 'true');
    if (level.state !== 'current') dot.innerHTML = advisorIcon(level.state === 'locked' ? 'lock' : 'check');
    const name = element('span', 'progress-level-name');
    name.append(element('strong', '', `Nivel ${level.level}`), element('small', '', level.name));
    row.append(dot, name, element('span', 'progress-level-reward', money(level.reward)));
    row.addEventListener('click', () => onSelect(level.level));
    item.append(row);
    list.append(item);
    rowButtons.set(level.level, row);
  }
  listCard.append(list, element('p', 'progress-footnote', 'Las recompensas son metas del programa: se muestran aquí y no se suman automáticamente a tu cartera.'));

  side.append(currentCard, rewardCard, nextCard, listCard);
  layout.append(world, side);
  page.replaceChildren(heading, layout);

  const select = level => {
    for (const [id, row] of rowButtons) row.setAttribute('aria-pressed', String(id === level));
    for (const [id, label] of labelButtons) label.classList.toggle('is-selected', id === level);
  };
  select(selected);
  return { stage, labels: labelButtons, status, select };
}
