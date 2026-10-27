// Orden de las tarjetas de Inicio: dos columnas que el asesor reacomoda. Funciones puras,
// sin DOM, para poder probarlas; el arrastre vive en dashboard-drag.js.
export const DASHBOARD_CARDS = ['ranking', 'goal', 'portfolio', 'clients', 'weekly'];
// Por defecto: clientes y ventas a la izquierda; ranking, meta y avance a la derecha.
export const DEFAULT_LAYOUT = Object.freeze({ left: ['clients', 'weekly'], right: ['ranking', 'goal', 'portfolio'] });

const copy = layout => ({ left: [...layout.left], right: [...layout.right] });

// Solo se acepta un orden guardado que tenga las cinco tarjetas, cada una una vez.
export function parseLayout(raw) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const all = [...(value?.left ?? []), ...(value?.right ?? [])];
    const valid = Array.isArray(value?.left) && Array.isArray(value?.right)
      && all.length === DASHBOARD_CARDS.length && DASHBOARD_CARDS.every(id => all.includes(id));
    // Un orden viejo con 4 y 1 se reparte 3/2 al cargarlo.
    return valid ? evenColumns(value) : copy(DEFAULT_LAYOUT);
  } catch {
    return copy(DEFAULT_LAYOUT);
  }
}

export function isDefaultLayout(layout) {
  return JSON.stringify(copy(layout)) === JSON.stringify(DEFAULT_LAYOUT);
}

function locate(layout, id) {
  for (const side of ['left', 'right']) {
    const index = layout[side].indexOf(id);
    if (index >= 0) return { side, index };
  }
  return null;
}

// Intercambio: cada tarjeta toma el lugar exacto de la otra, en la misma columna o en la de enfrente.
export function swapCards(layout, a, b) {
  const next = copy(layout);
  const from = locate(next, a), to = locate(next, b);
  if (!from || !to || a === b) return next;
  next[from.side][from.index] = b;
  next[to.side][to.index] = a;
  return next;
}

// Poner una tarjeta encima o debajo de otra: sale de su columna y entra junto a la elegida.
// Se usa al soltar en la parte de arriba o de abajo (o en el espacio vacío) de una tarjeta.
export function placeNear(layout, id, targetId, where = 'below') {
  const next = copy(layout);
  if (id === targetId || !locate(next, id) || !locate(next, targetId)) return next;
  for (const side of ['left', 'right']) next[side] = next[side].filter(item => item !== id);
  const target = locate(next, targetId);
  next[target.side].splice(target.index + (where === 'above' ? 0 : 1), 0, id);
  return evenColumns(next, id);
}

// Reparto 3/2: si una columna se pasa, su última tarjeta (nunca la que se movió) baja a la otra.
export function evenColumns(layout, keep = null) {
  const next = copy(layout);
  while (Math.abs(next.left.length - next.right.length) > 1) {
    const [long, short] = next.left.length > next.right.length ? ['left', 'right'] : ['right', 'left'];
    const spill = [...next[long]].reverse().find(item => item !== keep);
    next[long] = next[long].filter(item => item !== spill);
    next[short].push(spill);
  }
  return next;
}

// En una sola columna (celular) se leen intercaladas: izquierda, derecha, izquierda…
export function stackedOrder(layout) {
  const order = [];
  for (let index = 0; index < Math.max(layout.left.length, layout.right.length); index++) {
    if (layout.left[index]) order.push(layout.left[index]);
    if (layout.right[index]) order.push(layout.right[index]);
  }
  return order;
}

// Vecino para mover con el teclado: arriba/abajo en la columna; izquierda/derecha a la de enfrente.
export function neighborOf(layout, id, direction) {
  const at = locate(layout, id);
  if (!at) return null;
  const column = layout[at.side];
  if (direction === 'up') return column[at.index - 1] ?? null;
  if (direction === 'down') return column[at.index + 1] ?? null;
  const other = layout[at.side === 'left' ? 'right' : 'left'];
  if ((direction === 'left' && at.side === 'right') || (direction === 'right' && at.side === 'left')) return other[Math.min(at.index, other.length - 1)] ?? null;
  return null;
}

const columnHeight = (ids, heights, gap) => ids.reduce((total, id) => total + (heights[id] ?? 0), 0) + Math.max(0, ids.length - 1) * gap;

// Rellenar el hueco: si una columna queda con mucho espacio vacío, la última tarjeta de la
// columna más alta (nunca la que se acaba de mover) pasa al final de la otra, siempre que eso
// las empareje más y se mantenga el reparto 3/2. Se repite hasta dos veces.
export function fillGap(layout, heights, { keep = null, gap = 20, tolerance = 120 } = {}) {
  let next = copy(layout);
  const diff = candidate => Math.abs(columnHeight(candidate.left, heights, gap) - columnHeight(candidate.right, heights, gap));
  for (let round = 0; round < 2; round++) {
    if (diff(next) < tolerance) break;
    const tall = columnHeight(next.left, heights, gap) >= columnHeight(next.right, heights, gap) ? 'left' : 'right';
    const short = tall === 'left' ? 'right' : 'left';
    const spill = [...next[tall]].reverse().find(id => id !== keep);
    if (!spill) break;
    const candidate = copy(next);
    candidate[tall] = candidate[tall].filter(id => id !== spill);
    candidate[short].push(spill);
    if (diff(candidate) >= diff(next) || Math.abs(candidate.left.length - candidate.right.length) > 1) break;
    next = candidate;
  }
  return next;
}
