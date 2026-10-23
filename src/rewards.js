import { advisorIcon } from './advisor-icons.js';

export const rewardCategories = [
  ['all', 'Todos'], ['fun', 'Entretenimiento'], ['shop', 'Compras'], ['money', 'Dinero'], ['time', 'Tiempo libre'],
];

export const rewards = [
  { id: 'cinema', name: 'Bono de cine', description: 'Dos entradas para la función que prefieras.', cost: 100, category: 'fun', icon: 'film', color: '#0aa5d6' },
  { id: 'grocery', name: 'Bono de Falabella', description: '$50.000 para tu mercado de la semana.', cost: 150, category: 'shop', icon: 'cart', color: '#14a37f' },
  { id: 'restaurant', name: 'Bono de restaurante', description: '$60.000 para disfrutar con tu familia.', cost: 200, category: 'fun', icon: 'food', color: '#e0731a' },
  { id: 'free-afternoon', name: 'Bono de tarde libre', description: 'Una tarde para desconectarte y disfrutar a tu ritmo.', cost: 350, category: 'time', icon: 'sun', color: '#e0a100' },
  { id: 'cash-200', name: 'Bono de Zara', description: 'Un bono para lo que necesites.', cost: 600, category: 'money', icon: 'cash', color: '#7a5af5' },
  { id: 'haunted-cinema', name: 'Noche de cine de terror', description: 'Dos entradas y un combo para una noche de sustos.', cost: 180, category: 'fun', icon: 'film', color: '#7a5af5', featured: 'Evento limitado' },
  { id: 'sweet-treat', name: 'Bono dulce de Halloween', description: '$40.000 para compartir tus dulces favoritos.', cost: 120, category: 'shop', icon: 'cart', color: '#e0731a', featured: 'Evento limitado' },
];

// Las fotos son verticales (3:4) y se muestran en un marco cuadrado; `focus` es el
// object-position vertical que deja a Topitín completo y centrado en cada una.
const rewardImages = {
  cinema: { src: '/premios/bono-cine.png', focus: '40%' },
  grocery: { src: '/premios/bono-falabella.png', focus: '55%' },
  restaurant: { src: '/premios/bono-restaurante.png', focus: '55%' },
  'free-afternoon': { src: '/premios/bono-tarde-libre.jpg', focus: '48%' },
  'cash-200': { src: '/premios/bono-zara.png', focus: '52%' },
  'haunted-cinema': { src: '/premios/bono-noche-de-terror.png', focus: '36%' },
  'sweet-treat': { src: '/premios/bono-dulce-halloween.png', focus: '67%' },
};

const icons = {
  all: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
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

export function rewardPoints(profilePoints) {
  return Math.max(0, Number(profilePoints) || 0);
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

export function renderRewards(page, profilePoints, now = new Date()) {
  const points = rewardPoints(profilePoints);
  page.className = 'rewards-page';
  page.innerHTML = `
    <header class="shop-heading">
      <div><p class="shop-eyebrow">Un premio para cada logro</p>
        <h1 tabindex="-1">Catálogo de premios</h1>
        <p>Tu esfuerzo se convierte en recompensas.</p>
      </div>
      <div class="shop-xp rewards-balance"><span aria-hidden="true">✦</span>
        <div><span>Puntos acumulados</span><strong>${points.toLocaleString('es-CO')} <small>pts</small></strong></div>
      </div>
    </header>
    <section class="rewards-featured halloween-collection" aria-labelledby="rewards-featured-title">
      <div class="halloween-backdrop" aria-hidden="true"></div><div class="halloween-content">
      <div><span class="rewards-tag">Exclusivo</span><h2 id="rewards-featured-title">Exclusivos de Halloween</h2>
        <p>Dos premios especiales durante el evento de Halloween.</p>
      </div>
      <div class="rewards-chips">
        <div><strong>Quedan 06 días 14 h 32 min</strong><span>Suma puntos antes de que termine el evento.</span></div>
        <div><strong>Tu saldo está sincronizado</strong><span>Los puntos provienen de tu perfil y reflejan tu progreso actual.</span></div>
      </div>
      <div class="rewards-showcase">
        <ul class="rewards-grid rewards-grid-featured"></ul>
        ${now.getMonth() === 9 ? '<div class="halloween-decoration" aria-hidden="true"><img class="halloween-mascot" src="/shop/halloween-topitin.png" alt="" width="1389" height="1132" loading="lazy" decoding="async"></div>' : ''}
      </div></div>
    </section>
    <section class="shop-collection" aria-labelledby="rewards-collection-title">
      <div class="shop-collection-heading"><div><h2 id="rewards-collection-title">Colección de premios</h2>
        <p id="rewards-concept-note">Vista conceptual. Prueba cualquier bono: no descontamos puntos ni enviamos correos.</p></div>
        <span class="shop-count" aria-live="polite"></span>
      </div>
      <div class="rewards-filters" role="group" aria-label="Filtrar por categoría"></div>
      <ul class="rewards-grid rewards-grid-collection"></ul>
    </section>
    <aside class="shop-note"><span aria-hidden="true">✦</span><p><strong>Cada paso cuenta.</strong> Sigue completando tus tareas y descubre el próximo premio.</p></aside>
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
    control.type = 'button'; control.className = 'rewards-filter'; control.dataset.category = category;
    control.innerHTML = `${rewardIcon({ all: 'all', fun: 'film', shop: 'cart', money: 'cash', time: 'sun' }[category])}<span>${label}</span>`;
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
    const frame = reward.featured ? 'hechicero' : 'clasico';
    const photo = rewardImages[reward.id];
    card.innerHTML = `
      <span class="rewards-card-frame" style="--frame-image: url('/shop/frames/skins/${frame}-frame.png')" aria-hidden="true"></span>
      <div class="rewards-art">${reward.featured ? `<span class="rewards-tag rewards-tag-${reward.featured === 'Exclusivo' ? 'exclusive' : 'event'}">${reward.featured}</span>` : ''}
        <div class="rewards-photo" aria-hidden="true">${photo ? `<img src="${photo.src}" alt="" width="3" height="4" decoding="async" style="--photo-focus: ${photo.focus}">` : ''}</div>
      </div>
      <div class="rewards-card-details"><h3>${reward.name}</h3><p>${reward.description}</p>
        <p class="rewards-cost">${reward.cost.toLocaleString('es-CO')} puntos</p>
        <p class="rewards-availability">${progress.reachable ? `${advisorIcon('check')} Disponible` : `Te faltan ${progress.missing.toLocaleString('es-CO')} puntos`}</p>
        <button type="button" class="rewards-action" aria-label="Simular canje de ${reward.name}" aria-describedby="rewards-concept-note">Simular canje</button>
        ${progress.reachable ? '' : `<div class="rewards-track" role="progressbar" aria-label="Progreso hacia ${reward.name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percentage}"><span style="width: ${progress.percentage}%"></span></div>`}
      </div>`;
    card.addEventListener('click', () => showRewardPreview(reward, card.querySelector('button')));
    grid.append(card);
  }
}

export function showRewardPreview(reward, trigger) {
  document.querySelector('.rewards-dialog')?.close();
  const dialog = document.createElement('dialog');
  dialog.className = 'rewards-dialog';
  dialog.setAttribute('aria-labelledby', 'rewards-dialog-title');
  dialog.setAttribute('aria-describedby', 'rewards-dialog-message rewards-dialog-disclaimer');
  dialog.innerHTML = `
    <img class="rewards-dialog-mascot" src="/mascot/pinguino-feliz.png" alt="Topitín feliz" width="140" height="140">
    <p class="rewards-dialog-speaker">Topitín celebra contigo</p>
    <h2 id="rewards-dialog-title">¡Bono reclamado!</h2>
    <p id="rewards-dialog-message">¡Te llegó al correo! Disfruta tu <strong>${reward.name}</strong>. ¡Cada logro merece celebrarse!</p>
    <p id="rewards-dialog-disclaimer">Solo es una simulación. No enviamos ningún correo, no descontamos puntos y no registramos un canje.</p>
    <button type="button" class="rewards-action" autofocus>¡A seguir sumando!</button>`;
  const close = () => dialog.close();
  dialog.querySelector('button').addEventListener('click', close);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    }
  });
  dialog.addEventListener('close', () => { dialog.remove(); trigger?.focus(); }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
}
