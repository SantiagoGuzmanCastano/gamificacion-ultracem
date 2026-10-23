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
  goalCard.append(ring, goalCopy);

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
  stopMoneyRain();
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
    // El total que se llevó a casa: destello verde y un par de monedas que salen de la billetera.
    tl.from(q('.commission-takehome-icon'), { scale: .5, rotation: -30, duration: .7, ease: 'back.out(1.6)' }, .35);
    tl.fromTo(q('.commission-takehome'), { '--takehome-sheen': -120 }, { '--takehome-sheen': 120, duration: 1.2, ease: 'power2.inOut' }, 1);
    for (const icon of q('.commission-takehome-icon')) {
      for (let index = 0; index < 3; index++) {
        const coin = document.createElement('span');
        coin.className = 'commission-takehome-coin';
        coin.setAttribute('aria-hidden', 'true');
        icon.append(coin);
        tl.fromTo(coin, { y: 0, x: 0, opacity: 0, scale: .5 }, { y: -38 - index * 10, x: (index - 1) * 16, opacity: 1, scale: 1, duration: .45, ease: 'power3.out', onComplete: () => gsap.to(coin, { opacity: 0, y: '-=12', duration: .35, onComplete: () => coin.remove() }) }, 1.05 + index * .1);
      }
    }
    tl.from(q('.commission-goal-card, .commission-challenge-card'), { opacity: 0, y: 28, duration: .6, stagger: .12 }, .35);
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
    // Cartera vacía: la tarjeta sube, Topitín entra saltando y los pasos aparecen en orden.
    tl.from(q('.commission-empty'), { opacity: 0, y: 30, duration: .6 }, .5);
    tl.from(q('.commission-empty-mascot'), { opacity: 0, y: 60, rotation: -10, duration: .8, ease: 'back.out(1.8)' }, .75);
    tl.to(q('.commission-empty-mascot'), { y: -14, duration: .28, ease: 'power2.out', yoyo: true, repeat: 1 }, 1.6);
    tl.from(q('.commission-empty-copy > h2, .commission-empty-copy > p'), { opacity: 0, x: -16, duration: .45, stagger: .08 }, .8);
    tl.from(q('.commission-empty-steps li'), { opacity: 0, y: 14, duration: .45, stagger: .12 }, 1);
    tl.from(q('.commission-empty-step-icon'), { scale: 0, rotation: -120, duration: .55, stagger: .12, ease: 'back.out(2)' }, 1.05);
    tl.from(q('.commission-empty-cta'), { opacity: 0, scale: .85, duration: .5, ease: 'back.out(2)' }, 1.45);
  }, page);
}

// "Lo que te llevaste a casa": la tarjeta del total neto canjeado. Cada toque hace
// saltar una moneda; cinco toques seguidos hacen llover dinero un momento.
let takeHomeTaps = [];
let moneyRain = null;
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

export function stopMoneyRain() {
  moneyRain?.kill();
  moneyRain = null;
  document.querySelector('.commission-money-rain')?.remove();
  document.querySelector('.commission-bonus')?.remove();
  takeHomeTaps = [];
}

export function commissionTakeHome(amount, count, mascotSrc = mascotImages.happy) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'commission-summary-item commission-takehome';
  card.setAttribute('aria-label', `Total neto canjeado: ${cop(amount)}, ${count} ${count === 1 ? 'venta canjeada' : 'ventas canjeadas'}`);
  card.innerHTML = `<span class="commission-summary-icon commission-takehome-icon" aria-hidden="true">${advisorIcon('wallet')}</span>
    <div><span>Total neto canjeado</span><strong>${cop(amount)}</strong><small>${count} ${count === 1 ? 'venta canjeada' : 'ventas canjeadas'} · lo que te llevaste a casa</small></div>
    <span class="commission-takehome-shine" aria-hidden="true"></span>`;
  card.addEventListener('click', event => {
    if (document.querySelector('.commission-bonus')) return;
    const now = performance.now();
    takeHomeTaps = [...takeHomeTaps.filter(time => now - time < 1800), now];
    if (!reduced()) {
      const bounds = card.getBoundingClientRect();
      const origin = event.detail ? { x: event.clientX, y: event.clientY } : { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      popCoin(origin);
      gsap.fromTo(card.querySelector('.commission-takehome-icon'), { rotation: -14, scale: .92 }, { rotation: 0, scale: 1, duration: .45, ease: 'power3.out', clearProps: 'transform' });
    }
    if (takeHomeTaps.length >= 5) { takeHomeTaps = []; showBonus(mascotSrc, card); }
  });
  return card;
}

function popCoin(origin) {
  const coin = document.createElement('span');
  coin.className = 'commission-coin-pop';
  coin.setAttribute('aria-hidden', 'true');
  coin.textContent = '+$';
  document.body.append(coin);
  gsap.timeline({ onComplete: () => coin.remove() })
    .fromTo(coin, { x: origin.x, y: origin.y, xPercent: -50, yPercent: -50, scale: .6, opacity: 0, rotation: -20 }, { y: origin.y - 54, scale: 1, opacity: 1, rotation: 0, duration: .35, ease: 'power3.out' })
    .to(coin, { y: origin.y - 84, opacity: 0, duration: .35, ease: 'power1.in' });
}

// Pop-up del secreto: Topitín anuncia el bonus y, al cerrarse, llueve dinero.
function showBonus(mascotSrc, returnFocus) {
  const bonus = document.createElement('div');
  bonus.className = 'commission-bonus';
  bonus.innerHTML = `<div class="commission-bonus-card" role="status" aria-live="polite">
      <img class="commission-bonus-mascot" src="${mascotSrc}" alt="Topitín celebrando" width="150" height="150">
      <p class="commission-bonus-eyebrow">¡Encontraste el secreto de Topitín!</p>
      <p class="commission-bonus-value"><span>+</span><strong>5</strong><span>%</span></p>
      <p class="commission-bonus-text">Tu comisión por venta subió un 5%. ¡Sigue vendiendo así!</p>
      <p class="commission-bonus-note">Easter egg de demostración: tu comisión real no cambia.</p>
      <button type="button" class="commission-bonus-close">¡Que llueva!</button>
    </div>`;
  document.body.append(bonus);
  const card = bonus.querySelector('.commission-bonus-card');
  const value = bonus.querySelector('.commission-bonus-value strong');
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    window.clearTimeout(timer);
    const done = () => { bonus.remove(); returnFocus?.focus({ preventScroll: true }); if (!reduced()) rainMoney(); };
    if (reduced()) { done(); return; }
    gsap.timeline({ onComplete: done })
      .to(card, { y: -24, scale: .96, opacity: 0, duration: .28, ease: 'power2.in' })
      .to(bonus, { opacity: 0, duration: .2 }, '-=.12');
  };
  bonus.addEventListener('click', close);
  bonus.querySelector('.commission-bonus-close').focus({ preventScroll: true });
  const timer = window.setTimeout(close, 3600);
  if (reduced()) return;
  const counter = { value: 0 };
  gsap.timeline()
    .fromTo(bonus, { opacity: 0 }, { opacity: 1, duration: .25 })
    .fromTo(card, { y: 30, scale: .92, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: .5, ease: 'power3.out' }, .05)
    .fromTo(bonus.querySelector('.commission-bonus-mascot'), { y: 40, opacity: 0, rotation: -8 }, { y: 0, opacity: 1, rotation: 0, duration: .6, ease: 'back.out(1.5)' }, .2)
    .to(bonus.querySelector('.commission-bonus-mascot'), { y: -10, duration: .3, ease: 'power2.out', yoyo: true, repeat: 1 }, .85)
    .to(counter, { value: 5, duration: .8, ease: 'power2.out', onUpdate: () => { value.textContent = String(Math.round(counter.value)); } }, .45)
    .fromTo(bonus.querySelectorAll('.commission-bonus-eyebrow, .commission-bonus-text, .commission-bonus-note, .commission-bonus-close'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .35, stagger: .07 }, .5);
}

function rainMoney(count = 34) {
  stopMoneyRain();
  const layer = document.createElement('div');
  layer.className = 'commission-money-rain';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  const tl = gsap.timeline({ onComplete: () => { layer.remove(); if (moneyRain === tl) moneyRain = null; } });
  moneyRain = tl;
  for (let index = 0; index < count; index++) {
    const bill = index % 3 !== 2;
    const piece = document.createElement('span');
    piece.className = bill ? 'money-bill' : 'money-coin';
    piece.textContent = '$';
    layer.append(piece);
    const x = (index + Math.random()) / count * window.innerWidth;
    const start = Math.random() * .7;
    const duration = 1.5 + Math.random() * .6;
    gsap.set(piece, { x, y: -60, rotation: Math.random() * 60 - 30 });
    tl.to(piece, { y: window.innerHeight * (.75 + Math.random() * .2), duration, ease: 'power1.in' }, start)
      .to(piece, { x: x + (Math.random() - .5) * 140, rotation: `+=${bill ? 120 + Math.random() * 160 : 360}`, rotationY: bill ? 180 + Math.random() * 360 : 0, duration, ease: 'sine.inOut' }, start)
      .to(piece, { opacity: 0, duration: .4 }, start + duration - .4);
  }
}

// Reclamar una comisión: el botón se hunde, saltan monedas con el monto y, cuando la
// solicitud se confirma, cae una lluvia corta de dinero y brilla el total canjeado.
export function celebrateCommissionClaim(control, amount) {
  if (reduced()) return;
  const box = control.getBoundingClientRect();
  const origin = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  const layer = document.createElement('div');
  layer.className = 'commission-claim-burst';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  const tl = gsap.timeline({ onComplete: () => layer.remove() });
  gsap.fromTo(control, { scale: .94 }, { scale: 1, duration: .5, ease: 'power3.out', clearProps: 'scale' });
  for (let index = 0; index < 10; index++) {
    const coin = document.createElement('span');
    coin.className = 'money-coin';
    coin.textContent = '$';
    layer.append(coin);
    const angle = (-155 + index / 9 * 130 + (Math.random() - .5) * 12) * Math.PI / 180;
    const distance = 60 + Math.random() * 50;
    const at = index * .015;
    tl.fromTo(coin, { x: origin.x, y: origin.y, xPercent: -50, yPercent: -50, scale: .4, opacity: 0 },
      { x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance, scale: 1, opacity: 1, rotation: (Math.random() - .5) * 120, duration: .45, ease: 'power3.out' }, at)
      .to(coin, { y: `+=${70 + Math.random() * 40}`, opacity: 0, duration: .55, ease: 'power2.in' }, at + .45);
  }
  if (amount > 0) {
    const label = document.createElement('span');
    label.className = 'commission-claim-amount';
    label.textContent = `+${cop(amount)}`;
    layer.append(label);
    tl.fromTo(label, { x: origin.x, y: origin.y - 10, xPercent: -50, yPercent: -50, opacity: 0, scale: .85 }, { y: origin.y - 74, opacity: 1, scale: 1, duration: .5, ease: 'power3.out' }, .05)
      .to(label, { y: origin.y - 104, opacity: 0, duration: .4, ease: 'power1.in' }, .95);
  }
}

export function celebrateCommissionClaimed(page) {
  if (reduced()) return;
  rainMoney(24);
  const card = page.querySelector('.commission-takehome');
  if (!card) return;
  gsap.fromTo(card, { '--takehome-sheen': -120 }, { '--takehome-sheen': 120, duration: 1.1, ease: 'power2.inOut' });
  gsap.fromTo(card.querySelector('.commission-takehome-icon'), { rotation: -16, scale: .88 }, { rotation: 0, scale: 1, duration: .6, ease: 'power3.out', clearProps: 'transform' });
}
