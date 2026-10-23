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

// Solo visual: precios de muestra en ventas confirmadas; el canje no está implementado.
export const chests = [
  ['bronce', 'Bronce', 5], ['plata', 'Plata', 15], ['oro', 'Oro', 30],
].map(([id, name, price]) => ({ id, name: `Cofre de ${name}`, price, image: `/shop/chests/${id}.svg` }));

export function renderShop(page, sales, halloweenEnabled = false, equippedSkin = 'classic', onEquip = () => {}) {
  page.className = 'shop-page';
  page.innerHTML = `
    <header class="shop-heading">
      <div><p class="shop-eyebrow">Un estilo para cada logro</p>
        <h1 tabindex="-1">Tienda de Topitín</h1>
        <p>Tu esfuerzo tiene su propio estilo.</p></div>
      <div class="shop-xp"><span aria-hidden="true">✦</span>
        <div><span>Ventas confirmadas</span><strong>${Number(sales).toLocaleString('es-CO')}</strong></div></div>
    </header>
    <p class="shop-mode-status form-error" role="status" hidden></p>
    <section class="shop-collection" aria-labelledby="collection-title">
      <div class="shop-collection-heading"><div><h2 id="collection-title">Colección de atuendos</h2>
        <p>Conoce todos los estilos de Topitín. Los canjes estarán disponibles próximamente.</p></div>
        <span class="shop-count">10 atuendos</span></div>
      <ul class="shop-grid"></ul>
    </section>
    <section id="chest-collection" class="shop-collection chest-collection" aria-labelledby="chest-title">
      <div class="shop-collection-heading"><div><h2 id="chest-title">Cofres</h2>
        <p>Cofres con sorpresas para Topitín. Muy pronto podrás abrirlos con tus ventas.</p></div>
        <span class="shop-count">3 cofres</span></div>
      <ul class="chest-grid"></ul>
    </section>
    <aside class="shop-note"><span aria-hidden="true">✦</span><p><strong>Cada paso cuenta.</strong>
      Sigue completando tus tareas y descubre el próximo estilo de Topitín.</p></aside>`;
  appendCards(page.querySelector('.shop-grid'), outfits, equippedSkin, sales, onEquip);
  appendChestCards(page.querySelector('.chest-grid'));
  renderHalloweenCollection(page, halloweenEnabled, equippedSkin, sales, onEquip);
}

export function renderHalloweenCollection(page, enabled, equippedSkin = 'classic', sales = 0, onEquip = () => {}) {
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
    <div class="halloween-meta"><div class="halloween-timer"><img src="/shop/icons/timer.svg" alt=""><div><strong>Quedan 06 días 14 h 32 min</strong><span>Consigue más XP antes de que termine el evento.</span></div></div>
      <div class="halloween-xp"><img src="/shop/icons/xp.svg" alt=""><div><strong>Desbloquea estas skins recolectando XP</strong><span>Gana XP haciendo más ventas y completando tus objetivos.</span></div></div></div>
    <ul class="shop-grid"></ul></div>`;
  appendCards(section.querySelector('.shop-grid'), halloweenOutfits, equippedSkin, sales, onEquip);
  page.querySelector('.shop-collection').before(section);
}

function appendChestCards(grid) {
  for (const chest of chests) {
    const card = document.createElement('li');
    card.className = `chest-card chest-card-${chest.id}`;
    card.innerHTML = `
      <div class="chest-artwork"><img width="150" height="120" decoding="async"></div>
      <h3></h3>
      <p class="chest-price"><img src="/shop/chests/coin.svg" alt="" width="15" height="15"><span aria-hidden="true"></span><span class="sr-only"></span></p>
      <button type="button" class="chest-action" disabled>Próximamente</button>`;
    const image = card.querySelector('.chest-artwork img');
    image.src = chest.image;
    image.alt = chest.name;
    card.querySelector('h3').textContent = chest.name;
    card.querySelector('.chest-price [aria-hidden="true"]').textContent = `x${chest.price}`;
    card.querySelector('.chest-price .sr-only').textContent = `${chest.price} ventas para desbloquear`;
    grid.append(card);
  }
}

function appendCards(grid, collection, equippedSkin, sales, onEquip) {
  for (const [index, outfit] of collection.entries()) {
    const classic = outfit.id === 'clasico';
    const skeleton = outfit.id === 'esqueleto';
    const equipped = classic && equippedSkin === 'classic' || skeleton && equippedSkin === 'skeleton';
    const unlocked = skeleton && Number(sales) >= outfit.price;
    const canEquip = classic && !equipped || skeleton && unlocked && !equipped;
    const card = document.createElement('li');
    card.className = `shop-card shop-card-${outfit.id}${classic ? ' shop-card-classic' : ''}${outfit.id === 'zombie' || outfit.id === 'esqueleto' ? ' shop-card-halloween' : ''}${equipped ? ' shop-card-equipped' : ''}`;
    card.innerHTML = `
      <span class="shop-card-frame" style="--frame-image: url('${outfit.frame}')" aria-hidden="true"></span>
      <div class="shop-artwork" style="--skin-bg: url('/skins/backgrounds/${outfit.id}.webp')"><img src="${outfit.image}" alt="${outfit.name}" width="280" height="280"
        loading="eager" decoding="async"></div>
      <div class="shop-card-details"><h3>${outfit.name}</h3>
        ${classic
          ? '<p class="shop-included">Incluido</p>'
          : `<p class="shop-price"><strong>${outfit.price} ventas</strong><span>para desbloquear</span></p>`}
        <button type="button" class="shop-card-action${canEquip ? ' shop-card-action-ready' : ''}${equipped ? ' shop-card-action-equipped' : ''}" aria-pressed="${equipped}" ${canEquip || equipped ? '' : 'disabled'}>${equipped ? '✓ Equipado' : canEquip ? 'Equipar' : skeleton ? `Bloqueado · ${outfit.price} ventas` : 'Próximamente'}</button>
      </div>`;
    if (canEquip) card.querySelector('button').addEventListener('click', () => onEquip(classic ? 'classic' : 'skeleton'));
    grid.append(card);
  }
}
