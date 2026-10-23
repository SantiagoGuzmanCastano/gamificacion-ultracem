// Piezas compartidas por Resumen, Asesores y Zonas.
export function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

export const tons = value => value == null ? 's/d' : `${Math.round(value).toLocaleString('es-CO')} t`;
export const percent = (ratio, digits = 0) => ratio == null ? 's/d' : `${(ratio * 100).toLocaleString('es-CO', { maximumFractionDigits: digits })} %`;
export const count = value => value == null ? 's/d' : Number(value).toLocaleString('es-CO');

const LIGHT_LABELS = { green: 'Cumple', yellow: 'En riesgo', red: 'Crítico' };

// El semáforo siempre lleva texto: el color no es la única pista.
export function lightPill(light, label = LIGHT_LABELS[light]) {
  const pill = el('span', `admin-pill admin-pill-${light}`, label);
  pill.setAttribute('aria-label', `Estado: ${label}`);
  return pill;
}

export function header(title, description, badge = '') {
  const head = el('header', 'admin-head');
  const copy = el('div');
  copy.append(el('h1', '', title), el('p', '', description));
  head.append(copy);
  if (badge) head.append(el('span', 'admin-sample', badge));
  return head;
}

// Avisa que el mercado por zona aún es de muestra; asesores, clientes y ventas son reales.
export const marketBadge = market => market.sample ? 'Mercado: datos de muestra' : '';

export function bar(ratio, light) {
  const track = el('span', 'admin-bar');
  const fill = el('span', `admin-bar-fill admin-fill-${light}`);
  fill.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  track.append(fill);
  return track;
}
