const collection = [
  ['clasico', 'Clásico'], ['playero', 'Playero'], ['urbano', 'Urbano'],
  ['jazzy-dancer', 'Jazzy Dancer'], ['luchador', 'Luchador'], ['empresario', 'Empresario'],
  ['hacker', 'Hacker'], ['hechicero', 'Hechicero'], ['fenix', 'Fénix'], ['absoluto', 'Absoluto'],
];

export const outfits = collection.map(([id, name], index) => ({
  id, name: `Pingüino ${name}`, price: index * 50, image: `/skins/${id}.png`,
}));

export const halloweenOutfits = ['Zombie', 'Esqueleto'].map(name => ({
  id: name.toLowerCase(), name: `Pingüino ${name}`, image: `/skins/${name.toLowerCase()}.png`,
}));

export function renderShop(page, xp, halloweenEnabled = false) {
  page.className = 'shop-page';
  page.innerHTML = `
    <header class="shop-heading">
      <div><p class="shop-eyebrow">Un estilo para cada logro</p>
        <h1 tabindex="-1">Tienda de Topitín</h1>
        <p>Tu esfuerzo tiene su propio estilo.</p></div>
      <div class="shop-xp"><span aria-hidden="true">✦</span>
        <div><span>Tu experiencia actual</span><strong>${Number(xp).toLocaleString('es-CO')} XP</strong></div></div>
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
  appendCards(page.querySelector('.shop-grid'), outfits);
  renderHalloweenCollection(page, halloweenEnabled);
}

export function renderHalloweenCollection(page, enabled) {
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
  appendCards(section.querySelector('.shop-grid'), halloweenOutfits);
  page.querySelector('.shop-collection').before(section);
}

function appendCards(grid, collection) {
  for (const [index, outfit] of collection.entries()) {
    const classic = outfit.id === 'clasico';
    const card = document.createElement('li');
    card.className = `shop-card${classic ? ' shop-card-classic' : ''}`;
    card.innerHTML = `
      <div class="shop-artwork"><img src="${outfit.image}" alt="${outfit.name}" width="280" height="280"
        loading="eager" decoding="async"></div>
      <div class="shop-card-details"><h3>${outfit.name}</h3>
        ${classic
          ? '<p class="shop-included">Incluido</p>'
          : outfit.price === undefined ? '<p class="shop-included">Exclusivo de Halloween</p>'
            : `<p class="shop-price"><strong>${outfit.price} XP</strong><span>para desbloquear</span></p>`}
        <button type="button" class="shop-card-action" disabled>${classic ? 'Equipado' : 'Próximamente'}</button>
      </div>`;
    grid.append(card);
  }
}
