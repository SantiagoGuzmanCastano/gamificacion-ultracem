const collection = [
  ['clasico', 'Clásico'], ['playero', 'Playero'], ['urbano', 'Urbano'],
  ['jazzy-dancer', 'Jazzy Dancer'], ['luchador', 'Luchador'], ['empresario', 'Empresario'],
  ['hacker', 'Hacker'], ['hechicero', 'Hechicero'], ['fenix', 'Fénix'], ['absoluto', 'Absoluto'],
];

export const outfits = collection.map(([id, name], index) => ({
  id, name: `Pingüino ${name}`, price: index * 50, image: `/skins/${id}.png`,
}));

export const halloweenOutfits = [
  ['zombie', 'Zombie', 300],
  ['esqueleto', 'Esqueleto', 40],
].map(([id, name, price]) => ({ id, name: `Pingüino ${name}`, price, image: `/skins/${id}.png` }));

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
    <aside class="shop-note"><span aria-hidden="true">✦</span><p><strong>Cada paso cuenta.</strong>
      Sigue completando tus tareas y descubre el próximo estilo de Topitín.</p></aside>`;
  appendCards(page.querySelector('.shop-grid'), outfits, equippedSkin, sales, onEquip);
  renderHalloweenCollection(page, halloweenEnabled, equippedSkin, sales, onEquip);
}

export function renderHalloweenCollection(page, enabled, equippedSkin = 'classic', sales = 0, onEquip = () => {}) {
  const existing = page.querySelector('#halloween-collection');
  if (!enabled) { existing?.remove(); return; }
  if (existing) return;
  const section = document.createElement('section');
  section.id = 'halloween-collection';
  section.className = 'shop-collection';
  section.setAttribute('aria-labelledby', 'halloween-title');
  section.innerHTML = `<div class="shop-collection-heading"><div><h2 id="halloween-title">Exclusivos de Halloween</h2>
    <p>Dos estilos especiales de Topitín disponibles durante el modo Halloween. Canjes próximamente.</p></div>
    <span class="shop-count">2 atuendos</span></div><ul class="shop-grid"></ul>`;
  appendCards(section.querySelector('.shop-grid'), halloweenOutfits, equippedSkin, sales, onEquip);
  page.querySelector('.shop-collection').before(section);
}

function appendCards(grid, collection, equippedSkin, sales, onEquip) {
  for (const [index, outfit] of collection.entries()) {
    const classic = outfit.id === 'clasico';
    const skeleton = outfit.id === 'esqueleto';
    const equipped = classic && equippedSkin === 'classic' || skeleton && equippedSkin === 'skeleton';
    const unlocked = skeleton && Number(sales) >= 1;
    const canEquip = classic && !equipped || skeleton && unlocked && !equipped;
    const card = document.createElement('li');
    card.className = `shop-card${classic ? ' shop-card-classic' : ''}${equipped ? ' shop-card-equipped' : ''}`;
    card.innerHTML = `
      <div class="shop-artwork"><img src="${outfit.image}" alt="${outfit.name}" width="280" height="280"
        loading="eager" decoding="async"></div>
      <div class="shop-card-details"><h3>${outfit.name}</h3>
        ${classic
          ? '<p class="shop-included">Incluido</p>'
          : `<p class="shop-price"><strong>${outfit.price} ventas</strong><span>para desbloquear</span></p>`}
        <button type="button" class="shop-card-action${canEquip ? ' shop-card-action-ready' : ''}${equipped ? ' shop-card-action-equipped' : ''}" aria-pressed="${equipped}" ${canEquip || equipped ? '' : 'disabled'}>${equipped ? '✓ Equipado' : canEquip ? 'Equipar' : skeleton ? 'Bloqueado · 1 venta' : 'Próximamente'}</button>
      </div>`;
    if (canEquip) card.querySelector('button').addEventListener('click', () => onEquip(classic ? 'classic' : 'skeleton'));
    grid.append(card);
  }
}
