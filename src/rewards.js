import { advisorIcon } from './advisor-icons.js';

// Frontend-only catalog: points are derived from confirmed sales and nothing is redeemed or persisted yet.
export const POINTS_PER_SALE = 50;

export const rewardCategories = [
  ['all', 'Todos'], ['fun', 'Entretenimiento'], ['shop', 'Compras'], ['money', 'Dinero'], ['time', 'Tiempo libre'],
];

export const rewards = [
  { id: 'half-day', name: 'Medio día libre', description: 'Termina tu jornada al mediodía un día de tu elección.', cost: 500, category: 'time', icon: 'sun', color: '#e0a100', featured: 'Exclusivo' },
  { id: 'cash-100', name: 'Bono de dinero $100.000', description: 'Disponible solo durante el reto del mes.', cost: 400, category: 'money', icon: 'cash', color: '#7a5af5', featured: 'Evento limitado' },
  { id: 'cinema', name: 'Bono de cine', description: 'Dos entradas para la función que prefieras.', cost: 100, category: 'fun', icon: 'film', color: '#0aa5d6' },
  { id: 'grocery', name: 'Bono de supermercado', description: '$50.000 para tu mercado de la semana.', cost: 150, category: 'shop', icon: 'cart', color: '#14a37f' },
  { id: 'restaurant', name: 'Bono de restaurante', description: '$60.000 para disfrutar con tu familia.', cost: 200, category: 'fun', icon: 'food', color: '#e0731a' },
  { id: 'clothes', name: 'Bono de ropa', description: '$80.000 en tu tienda de ropa favorita.', cost: 250, category: 'shop', icon: 'shirt', color: '#2f7fe0' },
  { id: 'cash-200', name: 'Bono de dinero $200.000', description: 'Un bono para lo que necesites.', cost: 600, category: 'money', icon: 'cash', color: '#7a5af5' },
  { id: 'free-day', name: 'Medio día libre', description: 'Un día con jornada hasta el mediodía.', cost: 500, category: 'time', icon: 'sun', color: '#e0a100' },
];

const icons = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  cart: '<path d="M2 3h3l2.5 12h11L21 7H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  food: '<path d="M6 3v8a2 2 0 0 0 2 2v8M10 3v8M6 7h4M17 21V3c-2.5 1.5-3.5 4-3.5 7s1 4 3.5 4"/>',
  shirt: '<path d="M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
};

function rewardIcon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

export function rewardPoints(confirmedSales) {
  return Math.max(0, Number(confirmedSales) || 0) * POINTS_PER_SALE;
}

export function rewardProgress(reward, points) {
  const missing = Math.max(0, reward.cost - points);
  return { reachable: missing === 0, missing, percentage: Math.min(100, Math.round(points / reward.cost * 100)) };
}

export function filterRewards(category) {
  return rewards.filter(reward => !reward.featured && (category === 'all' || reward.category === category));
}

export function daysLeftInMonth(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const hours = Math.max(0, Math.floor((end - now) / 3600000));
  return { days: Math.floor(hours / 24), hours: hours % 24 };
}

let selectedCategory = 'all';

export function renderRewards(page, confirmedSales, now = new Date()) {
  const points = rewardPoints(confirmedSales);
  const left = daysLeftInMonth(now);
  const month = now.toLocaleDateString('es-CO', { month: 'long' });
  // Not .shop-page: the Halloween sync injects seasonal outfits into that page.
  page.className = 'rewards-page';
  page.innerHTML = `
    <header class="shop-heading">
      <div><p class="shop-eyebrow">Un premio para cada logro</p>
        <h1 tabindex="-1">Catálogo de premios</h1>
        <p>Tu esfuerzo en ventas se convierte en recompensas.</p></div>
      <div class="shop-xp rewards-balance"><span aria-hidden="true">✦</span>
        <div><span>Puntos acumulados</span><strong>${points.toLocaleString('es-CO')} <small>pts</small></strong></div></div>
    </header>
    <section class="rewards-featured" aria-labelledby="rewards-featured-title">
      <div><span class="rewards-tag">Destacados</span><h2 id="rewards-featured-title">Premios del mes</h2>
        <p>Dos recompensas especiales durante el reto de ${month}.</p></div>
      <div class="rewards-chips">
        <div><strong>Quedan ${left.days} ${left.days === 1 ? 'día' : 'días'} ${left.hours} h</strong><span>Suma puntos antes de que termine el reto.</span></div>
        <div><strong>Cada venta confirmada suma ${POINTS_PER_SALE} puntos</strong><span>Completa tus tareas y confirma ventas para avanzar.</span></div>
      </div>
      <ul class="rewards-grid rewards-grid-featured"></ul>
    </section>
    <section class="shop-collection" aria-labelledby="rewards-collection-title">
      <div class="shop-collection-heading"><div><h2 id="rewards-collection-title">Colección de premios</h2>
        <p>Conoce cómo podrás usar tus puntos. Los canjes estarán disponibles próximamente.</p></div>
        <span class="shop-count" aria-live="polite"></span></div>
      <div class="rewards-filters" role="group" aria-label="Filtrar por categoría"></div>
      <ul class="rewards-grid rewards-grid-collection"></ul>
    </section>
    <aside class="shop-note"><span aria-hidden="true">✦</span><p><strong>Cada paso cuenta.</strong>
      Sigue completando tus tareas y descubre el próximo premio.</p></aside>
    <p class="rewards-legal">Premios de demostración. Los puntos no se convierten en dinero en esta etapa del MVP.</p>`;
  appendRewardCards(page.querySelector('.rewards-grid-featured'), rewards.filter(reward => reward.featured), points);
  const filters = page.querySelector('.rewards-filters');
  const paintCollection = () => {
    const visible = filterRewards(selectedCategory);
    page.querySelector('.shop-count').textContent = `${visible.length} ${visible.length === 1 ? 'premio' : 'premios'}`;
    page.querySelector('.rewards-grid-collection').replaceChildren();
    appendRewardCards(page.querySelector('.rewards-grid-collection'), visible, points);
    filters.querySelectorAll('button').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.category === selectedCategory)));
  };
  for (const [category, label] of rewardCategories) {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'rewards-filter';
    control.dataset.category = category;
    control.textContent = label;
    control.addEventListener('click', () => { selectedCategory = category; paintCollection(); });
    filters.append(control);
  }
  paintCollection();
}

function appendRewardCards(grid, collection, points) {
  for (const reward of collection) {
    const progress = rewardProgress(reward, points);
    const card = document.createElement('li');
    card.className = `rewards-card${reward.featured ? ' rewards-card-featured' : ''}${progress.reachable ? ' rewards-card-reachable' : ''}`;
    card.style.setProperty('--reward-color', reward.color);
    card.innerHTML = `
      <div class="rewards-art">${reward.featured ? `<span class="rewards-tag rewards-tag-${reward.featured === 'Exclusivo' ? 'exclusive' : 'event'}">${reward.featured}</span>` : ''}
        <span class="rewards-art-icon">${rewardIcon(reward.icon)}</span></div>
      <div class="rewards-card-details"><h3>${reward.name}</h3><p>${reward.description}</p>
        <p class="rewards-cost">${reward.cost.toLocaleString('es-CO')} puntos</p>
        <button type="button" class="shop-card-action" disabled>${progress.reachable ? 'Canje próximamente' : `Te faltan ${progress.missing.toLocaleString('es-CO')} puntos`}</button>
        ${progress.reachable ? `<p class="rewards-ready">${advisorIcon('check')} Ya tienes los puntos</p>` : `<div class="rewards-track" role="progressbar" aria-label="Progreso hacia ${reward.name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percentage}"><span style="width: ${progress.percentage}%"></span></div>`}
      </div>`;
    grid.append(card);
  }
}
