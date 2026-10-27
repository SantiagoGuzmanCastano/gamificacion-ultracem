import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { Flip } from 'gsap/Flip';
import { clearFillers, syncFillers } from './dashboard-filler.js';
import { fillGap, isDefaultLayout, neighborOf, parseLayout, placeNear, stackedOrder, swapCards } from './dashboard-layout.js';

gsap.registerPlugin(Draggable, Flip);

// Gancho de percha: la tarjeta «cuelga» de él mientras se arrastra.
const HANGER = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4.5" r="2.4"/><path d="M12 6.9v3.6M4 19.5 12 10.5l8 9Z"/></svg>';

let dragging = false;
let draggables = [];

export const isDashboardDragging = () => dragging;

const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
const stacked = () => globalThis.matchMedia?.('(max-width: 1000px)').matches ?? false;

function readLayout(key) {
  try { return parseLayout(localStorage.getItem(key)); } catch { return parseLayout(null); }
}
function saveLayout(key, layout) {
  try {
    if (isDefaultLayout(layout)) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(layout));
  } catch { /* sin almacenamiento: el orden dura hasta recargar */ }
}

// Arma las tarjetas de Inicio en su orden guardado y las vuelve arrastrables desde el gancho.
export function mountDashboardCards({ overview, columns: [left, right], cards, titles, storageKey, filler = null, onSettle = () => {} }) {
  draggables.forEach(item => item.kill());
  draggables = [];
  clearFillers();
  let layout = readLayout(storageKey);
  const ids = Object.keys(cards);
  ids.forEach(id => { cards[id].dataset.card = id; });

  const live = document.createElement('p');
  live.className = 'dashboard-live';
  live.setAttribute('aria-live', 'polite');
  const bar = document.createElement('div');
  bar.className = 'dashboard-layout-bar';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'dashboard-reset';
  reset.textContent = 'Restablecer orden';
  reset.addEventListener('click', () => { commit(parseLayout(null), { fill: false }); live.textContent = 'Orden original restablecido.'; });
  bar.append(reset);
  overview.before(bar);
  overview.after(live);

  const place = next => {
    left.append(...next.left.map(id => cards[id]));
    right.append(...next.right.map(id => cards[id]));
    // En una sola columna manda el orden intercalado.
    stackedOrder(next).forEach((id, index) => { cards[id].style.setProperty('--stack-order', String(index)); });
    bar.hidden = isDefaultLayout(next);
  };
  // Alto natural de cada tarjeta, sin el estiramiento de la última de cada columna.
  const measure = () => {
    overview.classList.add('is-measuring');
    const heights = Object.fromEntries(ids.map(id => [id, cards[id].offsetHeight]));
    overview.classList.remove('is-measuring');
    return heights;
  };
  // El espacio vacío de la tarjeta estirada se llena con tips y datos (dashboard-filler.js).
  const refreshFillers = () => { if (filler && overview.isConnected) syncFillers(cards, measure(), { ...filler, enabled: !stacked() }); };
  const settle = () => { dragging = false; refreshFillers(); onSettle(); };
  // Aplica un orden nuevo con Flip: cada tarjeta viaja de donde estaba a su nuevo lugar.
  function commit(next, { moved = null, keep = moved?.dataset.card ?? null, fill = true } = {}) {
    const state = Flip.getState(ids.map(id => cards[id]));
    if (moved) gsap.set(moved, { x: 0, y: 0, rotation: 0, scale: 1 });
    place(next);
    // Si queda un hueco grande, la última tarjeta de la columna alta pasa a rellenarlo.
    if (fill && !stacked()) {
      const filled = fillGap(next, measure(), { keep });
      if (JSON.stringify(filled) !== JSON.stringify(next)) { next = filled; place(next); }
    }
    layout = next;
    saveLayout(storageKey, layout);
    Flip.from(state, { duration: reduced() ? 0 : .55, ease: 'power3.out', onComplete: settle });
  }

  place(layout);
  // Al cargar también se rellena el hueco (sin guardarlo: depende de cuánto contenido haya hoy).
  if (!stacked()) {
    const filled = fillGap(layout, measure());
    if (JSON.stringify(filled) !== JSON.stringify(layout)) { layout = filled; place(layout); }
  }
  refreshFillers();
  // Al cambiar el ancho de la ventana cambian los altos: se recalcula el relleno.
  let resizeTimer = 0;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (!overview.isConnected) { removeEventListener('resize', onResize); return; } refreshFillers(); }, 200); };
  addEventListener('resize', onResize);

  for (const id of ids) {
    const card = cards[id];
    const hook = document.createElement('button');
    hook.type = 'button';
    hook.className = 'dashboard-hook';
    hook.innerHTML = HANGER;
    hook.setAttribute('aria-label', `Mover «${titles[id]}». Enter para agarrar y flechas para mover`);
    hook.setAttribute('aria-pressed', 'false');
    card.append(hook);

    // Teclado: Enter o espacio agarra, las flechas intercambian con la vecina, Escape suelta.
    hook.addEventListener('keydown', event => {
      const grabbed = hook.getAttribute('aria-pressed') === 'true';
      const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        hook.setAttribute('aria-pressed', String(!grabbed));
        card.classList.toggle('is-grabbed', !grabbed);
        live.textContent = grabbed ? `${titles[id]} soltada.` : `${titles[id]} agarrada. Usa las flechas para moverla.`;
      } else if (event.key === 'Escape' && grabbed) {
        hook.setAttribute('aria-pressed', 'false');
        card.classList.remove('is-grabbed');
        live.textContent = `${titles[id]} soltada.`;
      } else if (grabbed && direction) {
        event.preventDefault();
        const other = neighborOf(layout, id, stacked() && (direction === 'left' || direction === 'right') ? null : direction);
        if (!other) return;
        dragging = true;
        commit(swapCards(layout, id, other), { keep: id });
        hook.focus({ preventScroll: false });
        live.textContent = `${titles[id]} cambió de lugar con ${titles[other]}.`;
      }
    });

    let target = null;
    let zone = 'swap';
    let moved = false;
    let natural = {};
    const marker = document.createElement('span');
    marker.className = 'dashboard-drop-marker';
    marker.setAttribute('aria-hidden', 'true');
    // Marca dónde caerá: línea dorada arriba, línea abajo o contorno (intercambio).
    const showDrop = (hit, where) => {
      ids.forEach(other => cards[other].classList.remove('is-drop-target'));
      marker.remove();
      if (!hit) return;
      if (where === 'swap') { hit.classList.add('is-drop-target'); return; }
      marker.className = `dashboard-drop-marker is-${where}`;
      hit.append(marker);
    };
    const [draggable] = Draggable.create(card, {
      type: 'x,y',
      trigger: hook,
      dragClickables: true,
      zIndexBoost: false,
      onPress() {
        // El giro nace en el gancho: la tarjeta cuelga de ahí.
        const box = card.getBoundingClientRect(), ring = hook.getBoundingClientRect();
        gsap.set(card, { transformOrigin: `${ring.left - box.left + ring.width / 2}px ${ring.top - box.top + ring.height / 2}px` });
      },
      onDragStart() {
        moved = true;
        dragging = true;
        natural = measure();
        card.classList.add('is-dragging');
        overview.classList.add('is-sorting');
        if (!reduced()) gsap.to(card, { scale: 1.02, duration: .2, ease: 'power2.out' });
      },
      onDrag() {
        // Péndulo: si va hacia un lado, el cuerpo se queda atrás y la tarjeta se inclina.
        if (!reduced()) gsap.to(card, { rotation: gsap.utils.clamp(-12, 12, this.deltaX * .9), duration: .35, ease: 'power2.out', overwrite: 'auto' });
        // pointerX/pointerY vienen con el scroll de la página; los rectángulos, sin él: se usa el evento.
        const point = this.pointerEvent?.changedTouches?.[0] ?? this.pointerEvent;
        const x = point?.clientX ?? this.pointerX - scrollX, y = point?.clientY ?? this.pointerY - scrollY;
        const hit = ids.map(other => cards[other]).find(other => {
          if (other === card) return false;
          const box = other.getBoundingClientRect();
          return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
        }) ?? null;
        // Zona según el mouse: arriba del contenido pone encima, abajo (o en el espacio vacío) pone debajo, el centro intercambia.
        let where = 'swap';
        if (hit) {
          const box = hit.getBoundingClientRect();
          const content = Math.min(box.height, natural[hit.dataset.card] ?? box.height);
          const ratio = (y - box.top) / content;
          where = ratio > 1 ? 'below' : ratio < .28 ? 'above' : ratio > .72 ? 'below' : 'swap';
        }
        if (hit !== target || where !== zone) { showDrop(hit, where); target = hit; zone = where; }
      },
      onRelease() {
        card.classList.remove('is-dragging');
        overview.classList.remove('is-sorting');
        // El péndulo ya no manda: se cortan sus tweens para que no pisen la vuelta.
        gsap.killTweensOf(card, 'rotation,scale');
        // Un clic sin arrastre no mueve nada (en onRelease, isDragging ya es falso).
        if (!moved) return;
        moved = false;
        if (target) {
          const other = target.dataset.card, where = zone;
          showDrop(null);
          target = null;
          zone = 'swap';
          gsap.set(card, { rotation: 0, scale: 1 });
          // Encima o debajo se respeta tal cual; el intercambio sí rebalancea las columnas.
          commit(where === 'swap' ? swapCards(layout, id, other) : placeNear(layout, id, other, where), { moved: card });
          live.textContent = where === 'swap' ? `${titles[id]} cambió de lugar con ${titles[other]}.` : `${titles[id]} quedó ${where === 'above' ? 'encima' : 'debajo'} de ${titles[other]}.`;
          return;
        }
        // Sin destino: vuelve a su sitio y se endereza con un rebote.
        gsap.to(card, { x: 0, y: 0, rotation: 0, scale: 1, duration: reduced() ? 0 : .7, ease: 'elastic.out(1, .45)', onComplete: settle });
      },
    });
    draggables.push(draggable);
  }
}

