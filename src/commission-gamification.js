import { gsap } from 'gsap';
import './commission-gamification.css';
import { advisorIcon } from './advisor-icons.js';
import { mascotImages } from './mascot.js';

// Metas fijas del programa: no existen en la base de datos todavía.
const MONTHLY_GOAL = 2000000;
const MONTHLY_TONS_TARGET = 50;
const CHALLENGE_STEPS = 6;
const stateLabels = { done: 'Completado', progress: 'En progreso', locked: 'Bloqueado' };

// Prueba de concepto: los logros son de muestra y no se leen de Supabase.
const sampleMilestones = [
  { icon: 'check', title: 'Primera comisión', reward: '+50 puntos', state: 'done' },
  { icon: 'coins', title: '$500.000 acumulados', reward: '+50 puntos', state: 'done' },
  { icon: 'clients', title: '5 ventas concretadas', reward: '+100 puntos', state: 'done' },
  { icon: 'sales', title: '$1.000.000 acumulados', reward: '+100 puntos', state: 'progress', progress: 68 },
  { icon: 'trophy', title: 'Meta mensual', reward: '+200 puntos', state: 'locked' },
  { icon: 'star', title: '10 ventas concretadas', reward: '+100 puntos', state: 'locked' },
];

const hasCommission = sale => Number(sale.commission_amount) > 0;
const sameMonth = (value, now) => { const date = new Date(value); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); };

// Deriva meta y desafío a partir de las ventas confirmadas del asesor (solo lectura).
export function commissionStats(ownSales, now = new Date()) {
  const monthly = ownSales.filter(sale => sameMonth(sale.confirmed_at || sale.completed_at, now));
  const earned = monthly.filter(hasCommission).reduce((total, sale) => total + Number(sale.commission_amount), 0);
  const tons = monthly.reduce((total, sale) => total + Number(sale.tons_sold || 0), 0);
  const monthName = now.toLocaleDateString('es-CO', { month: 'long' });
  const month = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${now.getFullYear()}`;
  return { month, goal: { target: MONTHLY_GOAL, earned }, challenge: { tons, target: MONTHLY_TONS_TARGET, steps: CHALLENGE_STEPS }, milestones: sampleMilestones };
}

function node(tag, className = '', text = '') {
  const item = document.createElement(tag);
  item.className = className;
  item.textContent = text;
  return item;
}
function icon(name, className) {
  const holder = node('span', className);
  holder.setAttribute('aria-hidden', 'true');
  holder.innerHTML = advisorIcon(name);
  return holder;
}
const cop = value => Number(value).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export function commissionMonthPill(sample) {
  const pill = node('div', 'commission-month');
  pill.append(icon('calendar', 'commission-month-icon'), node('span', '', sample.month));
  return pill;
}

export function commissionGoals(sample) {
  const { goal, challenge } = sample;
  const percentage = Math.min(100, Math.round(goal.earned / goal.target * 100));
  const row = node('section', 'commission-goals');
  row.setAttribute('aria-label', 'Metas del mes');

  const goalCard = node('article', 'commission-goal-card');
  const ring = node('div', 'commission-goal-ring');
  ring.setAttribute('role', 'img');
  ring.setAttribute('aria-label', `${percentage}% de la meta mensual`);
  ring.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="commissionGoldGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#f5a800"/></linearGradient></defs><circle class="ring-ticks" cx="50" cy="50" r="47.5" pathLength="100"/><circle class="ring-track" cx="50" cy="50" r="40"/><circle class="ring-fill" cx="50" cy="50" r="40" pathLength="100" stroke-dasharray="${Math.min(100, percentage)} 100"/></svg>`;
  ring.append(node('strong', '', `${percentage}%`));
  const goalCopy = node('div', 'commission-goal-copy');
  const goalTitle = node('h2', '', 'Meta mensual');
  goalTitle.prepend(icon('target', 'commission-card-icon'));
  const bar = node('div', 'commission-bar');
  const fill = node('span', 'commission-bar-fill');
  fill.style.width = `${Math.min(100, percentage)}%`;
  bar.append(fill);
  const figures = node('p', 'commission-goal-figures');
  figures.append(node('span', '', `${cop(goal.earned)} acumulado`), node('span', 'commission-goal-left', `Te faltan ${cop(Math.max(0, goal.target - goal.earned))}`));
  goalCopy.append(goalTitle, node('strong', 'commission-goal-target', cop(goal.target)), bar, figures);
  const mascot = node('img', 'commission-goal-mascot');
  mascot.src = mascotImages.happy;
  mascot.alt = '';
  goalCard.append(ring, goalCopy, mascot);

  const challengeCard = node('article', 'commission-challenge-card');
  const challengeTitle = node('h2', '', 'Desafío mensual');
  challengeTitle.prepend(icon('bolt', 'commission-card-icon'));
  const lit = Math.min(challenge.steps, Math.floor(challenge.tons / challenge.target * challenge.steps));
  const track = node('div', 'commission-challenge-track');
  track.setAttribute('role', 'img');
  track.setAttribute('aria-label', `${challenge.tons.toLocaleString('es-CO')} de ${challenge.target} toneladas`);
  for (let index = 0; index < challenge.steps; index += 1) track.append(icon('truck', `commission-challenge-step${index < lit ? ' lit' : ''}`));
  track.append(icon('flag', 'commission-challenge-finish'));
  const challengeBar = node('div', 'commission-bar');
  const challengeFill = node('span', 'commission-bar-fill blue');
  challengeFill.style.width = `${Math.min(100, Math.round(challenge.tons / challenge.target * 100))}%`;
  challengeBar.append(challengeFill);
  const head = node('div', 'commission-challenge-head');
  head.append(node('p', '', `Vende ${challenge.target} toneladas de cemento este mes.`), node('strong', '', `${challenge.tons.toLocaleString('es-CO')} / ${challenge.target} t`));
  challengeCard.append(challengeTitle, head, challengeBar, track);
  challengeCard.style.setProperty('--challenge-steps', challenge.steps + 1);

  row.append(goalCard, challengeCard);
  return row;
}

export function commissionMilestones(sample, onViewRedeemed = null) {
  const section = node('section', 'commission-milestones');
  const head = node('div', 'commission-milestones-head');
  const done = sample.milestones.filter(item => item.state === 'done').length;
  const title = node('div', 'commission-milestones-title');
  title.append(node('h2', 'commission-section-title', 'Hitos y logros'), node('span', 'commission-milestones-count', `${done} de ${sample.milestones.length} logros`));
  head.append(title);
  if (onViewRedeemed) {
    const link = node('button', 'commission-link', 'Ver comisiones ya reclamadas');
    link.type = 'button';
    link.append(icon('arrow', 'commission-link-icon'));
    link.addEventListener('click', onViewRedeemed);
    head.append(link);
  }
  const list = node('ol', 'commission-milestone-list');
  for (const item of sample.milestones) {
    const entry = node('li', `commission-milestone ${item.state}`);
    const badge = icon(item.state === 'locked' ? 'lock' : item.icon, 'commission-badge');
    if (item.state === 'progress') badge.style.setProperty('--badge-progress', `${item.progress}%`);
    const reward = node('span', 'commission-reward');
    reward.append(icon('star', 'commission-reward-icon'), item.reward);
    entry.append(badge, node('strong', '', item.title), reward, node('small', '', stateLabels[item.state]));
    list.append(entry);
  }
  section.append(head, list);
  return section;
}

let entrance = null;
let entered = false;

export function resetCommissionEntrance() {
  entrance?.revert();
  entrance = null;
  entered = false;
}

// Se reproduce una vez cada vez que se entra a la pestaña; los refrescos de datos no la repiten.
export function playCommissionEntrance(page) {
  if (entered) return;
  entered = true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const q = selector => page.querySelectorAll(selector);
  entrance = gsap.context(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => gsap.set(q('*'), { clearProps: 'transform,opacity' }) });
    tl.from(q('.commission-welcome > *'), { opacity: 0, y: -14, duration: .45, stagger: .08 }, 0);
    tl.from(q('.commission-balance'), { opacity: 0, y: 26, scale: .97, duration: .6 }, .1);
    tl.fromTo(q('.commission-balance'), { '--sheen': -120 }, { '--sheen': 120, duration: 1.3, ease: 'power2.inOut' }, .6);
    tl.from(q('.commission-balance-icon'), { scale: 0, rotation: -200, duration: .8, ease: 'back.out(1.8)' }, .3);
    tl.from(q('.commission-claim-all'), { opacity: 0, scale: .85, duration: .5, ease: 'back.out(2)' }, .8);
    tl.from(q('.commission-summary-item'), { opacity: 0, y: 26, duration: .6 }, .2);
    tl.from(q('.commission-goal-card, .commission-challenge-card'), { opacity: 0, y: 28, duration: .6, stagger: .12 }, .35);
    tl.from(q('.commission-goal-mascot'), { opacity: 0, x: 40, rotation: 8, duration: .7, ease: 'back.out(1.6)' }, .9);
    for (const node of q('.commission-balance-copy strong, .commission-summary-item strong, .commission-goal-ring strong')) {
      const original = node.textContent;
      const target = Number(original.replace(/\D/g, ''));
      if (!target) continue;
      const isPercent = original.includes('%');
      const counter = { value: 0 };
      tl.to(counter, {
        value: target, duration: 1.2, ease: 'power2.out',
        onUpdate: () => { node.textContent = isPercent ? `${Math.round(counter.value)}%` : cop(Math.round(counter.value)); },
        onComplete: () => { node.textContent = original; },
      }, .45);
    }
    for (const ring of q('.ring-fill')) tl.from(ring, { attr: { 'stroke-dasharray': '0 100' }, duration: 1.3, ease: 'power3.inOut' }, .55);
    tl.from(q('.commission-bar-fill'), { scaleX: 0, duration: 1.1, ease: 'power3.inOut', stagger: .15 }, .6);
    tl.from(q('.commission-challenge-step, .commission-challenge-finish'), { opacity: 0, y: 10, scale: .6, duration: .4, stagger: .08, ease: 'back.out(2)' }, .9);
    tl.from(q('.commission-available-section .commission-list-head > *'), { opacity: 0, x: -16, duration: .4, stagger: .08 }, 1);
    tl.from(q('.commission-available-section .commission-item'), { opacity: 0, x: -30, duration: .5, stagger: .1 }, 1.05);
    tl.from(q('.commission-milestones'), { opacity: 0, y: 24, duration: .5 }, 1.2);
    tl.from(q('.commission-badge'), { scale: 0, rotation: -60, duration: .55, stagger: .09, ease: 'back.out(2)' }, 1.35);
    tl.from(q('.commission-milestone > :not(.commission-badge)'), { opacity: 0, y: 8, duration: .35, stagger: .02 }, 1.5);
    tl.from(q('.commission-redeemed-section'), { opacity: 0, y: 20, duration: .5 }, 1.6);
  }, page);
}
