import { revealCards, swapStageArt } from './store-entrance.js';
import { eventCountdown } from './rewards.js';

const collection = [
  ['clasico', 'Clásico'], ['playero', 'Playero'], ['urbano', 'Urbano'],
  ['jazzy-dancer', 'Jazzy Dancer'], ['luchador', 'Luchador'], ['empresario', 'Empresario'],
  ['hacker', 'Hacker'], ['hechicero', 'Hechicero'], ['fenix', 'Fénix'], ['absoluto', 'Absoluto'],
];

export const outfits = collection.map(([id, name], index) => ({
  id, name: `Pingüino ${name}`, price: index * 50, image: `/skins/${id}.png`, frame: `/shop/frames/skins/${id}-frame.png`,
}));

export const halloweenOutfits = [
  ['zombie', 'Zombie', 300],
  ['esqueleto', 'Esqueleto', 2],
].map(([id, name, price]) => ({ id, name: `Pingüino ${name}`, price, image: `/skins/${id}.png`, frame: `/shop/frames/skins/${id}-frame.png` }));

// Sample prices are presentation only: no points are spent or new equipment enabled.
export const chests = [
  ['Común', 'Cofre Tricolor', 'El inicio de una aventura llena de recompensas.', 150],
  ['Raro', 'Cofre Aguamarina', 'Un tesoro inspirado en el Caribe colombiano.', 250],
  ['Súper Raro', 'Cofre El Dorado', 'Descubre las riquezas de una leyenda ancestral.', 400],
  ['Épico', 'Cofre Leyenda Muisca', 'Un tesoro que guarda el poder de los antiguos muiscas.', 600],
  ['Mítico', 'Cofre Esmeralda Colombiana', 'La joya más preciada de nuestras tierras.', 900],
].map(([rarity, name, description, price], index) => ({
  id: `cofre-${index + 1}`, rarity, name, description, price, currency: 'points',
  image: `/shop/chests/cofre-${index + 1}.png`,
  background: `/shop/chests/backgrounds/cofre-${index + 1}.png`,
  frame: `/shop/frames/skins/${['clasico', 'hacker', 'hechicero', 'jazzy-dancer', 'absoluto'][index]}-frame.png`,
}));

export const avatars = [
  ['cafe-colombiano', 'Café colombiano', 'empresario', 'La esencia y tradición del café de nuestra tierra.', 10],
  ['carnaval', 'Carnaval de Barranquilla', 'jazzy-dancer', 'Una explosión de alegría, ritmo y color.', 15],
  ['colombia', 'Orgullo Tricolor', 'clasico', 'Lleva los colores de Colombia con orgullo.', 20],
  ['medellin', 'Medellín, Ciudad de la Eterna Primavera', 'urbano', 'Inspirado en la magia y belleza de Medellín.', 25],
  ['sombrero-vueltiao', 'Herencia Zenú', 'playero', 'Un homenaje al emblemático sombrero vueltiao.', 30],
].map(([id, name, frame, description, price]) => ({
  id, name, description, price, currency: 'points',
  image: `/shop/avatars/${id}.png`, background: `/shop/avatars/backgrounds/${id}.png`,
  frame: `/shop/frames/skins/${frame}-frame.png`,
}));

function shopIcon(name) {
  const paths = {
    crown: 'M3 6l4 4 5-7 5 7 4-4-2 12H5L3 6zm2 15h14',
    outfits: 'M8 3l-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c0 4-8 4-8 0z',
    chests: 'M4 4h16l2 7H2l2-7zm-1 7v9h18v-9M9 4l-1 7m7-7 1 7m-6 0v4h4v-4',
    avatars: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21v-2a8 8 0 0 1 16 0v2z',
    sparkle: 'M12 2c1 7 3 9 10 10-7 1-9 3-10 10-1-7-3-9-10-10 7-1 9-3 10-10z',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3',
    check: 'M5 12l4 4L19 6',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="${paths[name]}"></path></svg>`;
}

function shopActionContent(label, price, icon = 'lock') {
  return `${shopIcon(icon)}<span class="shop-action-copy">${label === 'Desbloquear' ? `${price} puntos` : label === 'Disponible' ? `Disponible · ${price} puntos` : label}</span>`;
}

// Los catálogos conservan los PNG originales; las vistas cargan su versión WebP liviana.
const webp = path => path.replace(/\.png$/, '.webp');
const outfitStage = outfit => ({ name: outfit.name, art: webp(outfit.image), background: `/skins/backgrounds/${outfit.id}.webp` });
const itemStage = item => ({ name: item.name, art: webp(item.image), background: webp(item.background) });

function tryOnButton(stage, alt, loading = 'lazy') {
  return `<button type="button" class="shop-artwork shop-try" style="--skin-bg: url('${stage.background}')" aria-label="Probar ${stage.name} en el probador" aria-pressed="false"
    data-stage-name="${stage.name}" data-stage-art="${stage.art}" data-stage-bg="${stage.background}"><span class="shop-try-shine" aria-hidden="true"></span><img src="${stage.art}" alt="${alt}" width="280" height="280" loading="${loading}" decoding="async"></button>`;
}

export function renderShop(page, sales, halloweenEnabled = false, equippedSkin = 'classic', onEquip = () => {}, points = 0) {
  const balance = Number.isFinite(Number(points)) ? Math.max(0, Number(points)) : 0;
  const worn = outfitStage([...outfits, ...halloweenOutfits].find(outfit => outfit.id === (equippedSkin === 'skeleton' ? 'esqueleto' : 'clasico')));
  page.className = 'shop-page';
  page.innerHTML = `
    <header class="shop-heading">
      <div class="shop-heading-copy"><p class="shop-eyebrow">${shopIcon('crown')}<span>Un estilo para cada logro</span></p>
        <h1 tabindex="-1">Tienda de cosméticos</h1>
        <p>Tu esfuerzo ahora tiene su propio estilo.<br>Colecciona, personaliza y brilla con Topitín.</p>
        <div class="shop-xp"><span class="shop-balance-icon" aria-hidden="true">${shopIcon('sparkle')}</span>
          <div><span>Tus puntos para brillar</span><strong><span data-count>${balance.toLocaleString('es-CO')}</span> <small>puntos</small></strong></div>
          <p class="shop-balance-note">Toca un atuendo para ver cómo le queda a Topitín.</p></div></div>
      <figure class="shop-stage" style="--stage-bg: url('${worn.background}')">
        <span class="shop-stage-light" aria-hidden="true"></span>
        <span class="shop-stage-pedestal" aria-hidden="true"></span>
        <img class="shop-stage-art" src="${worn.art}" alt="Topitín con el atuendo ${worn.name}" width="320" height="320" decoding="async">
        <figcaption class="shop-stage-caption" aria-live="polite"><span>Llevas puesto</span><strong>${worn.name}</strong></figcaption>
      </figure>
    </header>
    <p class="shop-mode-status form-error" role="status" hidden></p>
    <div class="shop-tabs" role="tablist" aria-label="Colecciones de cosméticos">
      ${[['outfits', 'Atuendos'], ['chests', 'Cofres'], ['avatars', 'Avatares']].map(([id, label], index) => `<button type="button" class="shop-tab" id="shop-tab-${id}" role="tab" aria-controls="shop-panel-${id}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${shopIcon(id)}<span>${label}</span></button>`).join('')}
    </div>
    <div id="shop-panel-outfits" class="shop-panel" role="tabpanel" aria-labelledby="shop-tab-outfits" tabindex="0">
    <section class="shop-collection" aria-labelledby="collection-title">
      <div class="shop-collection-heading"><div><h2 id="collection-title">Colección de atuendos</h2>
        <p>Encuentra el estilo que va contigo y con tu próxima aventura.</p></div>
        <span class="shop-count">10 atuendos</span></div>
      <ul class="shop-grid"></ul>
    </section>
    </div>
    ${[['chests', chests], ['avatars', avatars]].map(([id, catalog]) => `
      <section id="shop-panel-${id}" class="shop-panel shop-collection" role="tabpanel" aria-labelledby="shop-tab-${id}" tabindex="0" hidden>
        <ul class="shop-grid">${catalog.map(item => `<li class="shop-card shop-card-${id}">
          <span class="shop-card-frame" style="--frame-image: url('${item.frame}')" aria-hidden="true"></span>
          ${tryOnButton(itemStage(item), item.name)}
          <div class="shop-card-details"><h3>${item.name}</h3><button type="button" class="shop-card-action${balance >= item.price ? ' shop-card-action-available' : ''}" disabled>${shopActionContent(balance >= item.price ? 'Disponible' : 'Desbloquear', item.price, balance >= item.price ? 'check' : 'lock')}</button></div>
        </li>`).join('')}</ul>
      </section>`).join('')}
    <aside class="shop-note"><span aria-hidden="true">✦</span><p><strong>Cada paso cuenta.</strong>
      Precios conceptuales: no se descuentan puntos. El equipamiento existente conserva sus reglas actuales.</p></aside>`;
  appendCards(page.querySelector('.shop-grid'), outfits, equippedSkin, sales, onEquip, balance);
  renderHalloweenCollection(page, halloweenEnabled, equippedSkin, sales, onEquip, balance);
  page.addEventListener('click', event => {
    const control = event.target?.closest?.('.shop-try');
    if (control) tryOn(page, control, worn);
  });
  const tabs = [...page.querySelectorAll('[role="tab"]')];
  const panels = [...page.querySelectorAll('[role="tabpanel"]')];
  const selectTab = (index, animate = false) => {
    tabs.forEach((tab, position) => {
      const selected = position === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[position].hidden = !selected;
    });
    if (animate) revealCards([...panels[index].querySelectorAll('.shop-card')]);
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(index, tab.getAttribute('aria-selected') !== 'true'));
    tab.addEventListener('keydown', event => {
      const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      selectTab(next, true);
      tabs[next].focus();
    });
  });
  selectTab(0);
}

// Solo cambia la vista previa: equipar sigue dependiendo del botón de la tarjeta.
function tryOn(page, control, worn) {
  const stage = page.querySelector('.shop-stage');
  const art = stage.querySelector('.shop-stage-art');
  const caption = stage.querySelector('.shop-stage-caption');
  const wasPressed = control.getAttribute('aria-pressed') === 'true';
  page.querySelectorAll('.shop-try[aria-pressed="true"]').forEach(other => other.setAttribute('aria-pressed', 'false'));
  const preview = wasPressed ? worn : { name: control.dataset.stageName, art: control.dataset.stageArt, background: control.dataset.stageBg };
  if (!wasPressed) control.setAttribute('aria-pressed', 'true');
  swapStageArt(art, () => {
    art.src = preview.art;
    art.alt = `Topitín con ${preview.name}`;
    stage.style.setProperty('--stage-bg', `url('${preview.background}')`);
    caption.innerHTML = `<span>${preview === worn ? 'Llevas puesto' : 'Vista previa'}</span><strong>${preview.name}</strong>`;
  });
  if (stage.getBoundingClientRect().bottom < 80) stage.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

export function renderHalloweenCollection(page, enabled, equippedSkin = 'classic', sales = 0, onEquip = () => {}, points = 0) {
  const existing = page.querySelector('#halloween-collection');
  if (!enabled) { existing?.remove(); return; }
  if (existing) return;
  const section = document.createElement('section');
  section.id = 'halloween-collection';
  section.className = 'shop-collection halloween-collection';
  section.setAttribute('aria-labelledby', 'halloween-title');
  section.innerHTML = `<div class="halloween-backdrop" aria-hidden="true"></div><div class="halloween-content">
    <div class="halloween-heading"><div><span class="halloween-badge"><img src="/shop/icons/pumpkin.svg" alt=""> Exclusivo</span>
      <h2 id="halloween-title">Exclusivos de Halloween</h2><p>Dos estilos especiales de Topitín disponibles durante el modo Halloween.</p></div>
      <span class="halloween-badge halloween-badge-event"><img src="/shop/icons/timer.svg" alt=""> Evento limitado</span></div>
    <div class="halloween-meta"><div class="halloween-timer"><img src="/shop/icons/timer.svg" alt=""><div><strong>${eventCountdown()}</strong><span>Consigue más XP antes de que termine el evento.</span></div></div>
      <div class="halloween-xp"><img src="/shop/icons/xp.svg" alt=""><div><strong>Desbloquea estas skins recolectando XP</strong><span>Gana XP haciendo más ventas y completando tus objetivos.</span></div></div></div>
    <div class="halloween-showcase"><ul class="shop-grid"></ul>
      <div class="halloween-decoration" aria-hidden="true"><img class="halloween-mascot" src="/shop/halloween-topitin.webp" alt="" aria-hidden="true" width="1389" height="1132" loading="lazy" decoding="async"></div>
    </div></div>`;
  appendCards(section.querySelector('.shop-grid'), halloweenOutfits, equippedSkin, sales, onEquip, points);
  page.querySelector('.shop-collection').before(section);
}

function appendCards(grid, collection, equippedSkin, sales, onEquip, points = 0) {
  for (const [index, outfit] of collection.entries()) {
    const classic = outfit.id === 'clasico';
    const skeleton = outfit.id === 'esqueleto';
    const equipped = classic && equippedSkin === 'classic' || skeleton && equippedSkin === 'skeleton';
    const displayPrice = skeleton ? 100 : outfit.price;
    // El esqueleto se equipa con 100 puntos (una venta confirmada) sin descontarlos;
    // la función equip_mvp_skin aplica la misma regla en Supabase.
    const unlocked = skeleton && Number(points) >= displayPrice;
    const canEquip = classic && !equipped || skeleton && unlocked && !equipped;
    const affordable = !equipped && Number.isFinite(Number(points)) && Number(points) >= displayPrice;
    const card = document.createElement('li');
    card.className = `shop-card shop-card-${outfit.id}${classic ? ' shop-card-classic' : ''}${outfit.id === 'zombie' || outfit.id === 'esqueleto' ? ' shop-card-halloween' : ''}${equipped ? ' shop-card-equipped' : ''}`;
    card.innerHTML = `
      <span class="shop-card-frame" style="--frame-image: url('${outfit.frame}')" aria-hidden="true"></span>
      ${tryOnButton(outfitStage(outfit), outfit.name, 'eager')}
      <div class="shop-card-details"><h3>${outfit.name}</h3>
        <button type="button" class="shop-card-action${canEquip ? ' shop-card-action-ready' : ''}${equipped ? ' shop-card-action-equipped' : ''}${affordable ? ' shop-card-action-available' : ''}" aria-pressed="${equipped}" ${canEquip || equipped ? '' : 'disabled'}>${shopActionContent(equipped ? 'Equipado' : canEquip ? 'Equipar' : affordable ? 'Disponible' : 'Desbloquear', displayPrice, equipped || canEquip || affordable ? 'check' : 'lock')}</button>
      </div>`;
    if (canEquip) card.querySelector('.shop-card-action').addEventListener('click', () => onEquip(classic ? 'classic' : 'skeleton'));
    grid.append(card);
  }
}
