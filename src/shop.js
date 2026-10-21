const collection = [
  ['clasico', 'Clásico'], ['playero', 'Playero'], ['urbano', 'Urbano'],
  ['jazzy-dancer', 'Jazzy Dancer'], ['luchador', 'Luchador'], ['empresario', 'Empresario'],
  ['hacker', 'Hacker'], ['hechicero', 'Hechicero'], ['fenix', 'Fénix'], ['absoluto', 'Absoluto'],
];

export const outfits = collection.map(([id, name], index) => ({
  id, name: `Pingüino ${name}`, price: index * 50, image: `/skins/${id}.png`,
}));

export function renderShop(page, xp) {
  page.className = 'shop-page';
  page.innerHTML = `
    <header class="shop-heading">
      <div><p class="shop-eyebrow">Un estilo para cada logro</p>
        <h1 tabindex="-1">Tienda de Topitín</h1>
        <p>Tu esfuerzo tiene su propio estilo.</p></div>
      <div class="shop-xp"><span aria-hidden="true">✦</span>
        <div><span>Tu experiencia actual</span><strong>${Number(xp).toLocaleString('es-CO')} XP</strong></div></div>
    </header>
    <section class="shop-collection" aria-labelledby="collection-title">
      <div class="shop-collection-heading"><div><h2 id="collection-title">Colección de atuendos</h2>
        <p>Conoce todos los estilos de Topitín. Los canjes estarán disponibles próximamente.</p></div>
        <span class="shop-count">10 atuendos</span></div>
      <ul class="shop-grid"></ul>
    </section>
    <aside class="shop-note"><span aria-hidden="true">✦</span><p><strong>Cada paso cuenta.</strong>
      Sigue completando tus tareas y descubre el próximo estilo de Topitín.</p></aside>`;
  const grid = page.querySelector('.shop-grid');
  for (const [index, outfit] of outfits.entries()) {
    const card = document.createElement('li');
    card.className = `shop-card${index === 0 ? ' shop-card-classic' : ''}`;
    card.innerHTML = `
      <div class="shop-artwork"><img src="${outfit.image}" alt="${outfit.name}" width="280" height="280"
        loading="${index < 4 ? 'eager' : 'lazy'}" decoding="async"></div>
      <div class="shop-card-details"><h3>${outfit.name}</h3>
        ${index === 0
          ? '<p class="shop-included">Incluido</p>'
          : `<p class="shop-price"><strong>${outfit.price} XP</strong><span>para desbloquear</span></p>`}
        <button type="button" class="shop-card-action" disabled>${index === 0 ? 'Equipado' : 'Próximamente'}</button>
      </div>`;
    grid.append(card);
  }
}
