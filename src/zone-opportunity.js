import { advisorIcon } from './advisor-icons.js';
import { formatPercent } from './format.js';

// PRD · Ver la oportunidad por zona (zona = departamento, objetivo = 10 %).
// Participación y mercado salen de public/data/zone-market.json (Muestra hasta tener el archivo real).
const round2 = value => Math.round(value * 100) / 100;
const tons = value => `${Math.round(value).toLocaleString('es-CO')} t`;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

export async function loadZoneMarket() {
  const response = await fetch('/data/zone-market.json');
  if (!response.ok) throw new Error('No se pudieron cargar los datos de mercado por zona.');
  return response.json();
}

export function getZoneOpportunities(market, clients, sales, { onlyWithClients = false } = {}) {
  const target = market.targetShare ?? 0.10;
  const sold = new Set(sales.filter(sale => sale.confirmed).map(sale => sale.client_id));
  const zones = market.zones.map(zone => {
    const own = clients.filter(client => client.department === zone.department);
    const attended = own.filter(client => sold.has(client.id)).length;
    const ratio = zone.marketTons ? zone.ultracemTons / zone.marketTons : 0;
    const defend = ratio >= target;
    return {
      code: zone.departmentCode,
      department: zone.department,
      marketTons: zone.marketTons,
      soldTons: zone.ultracemTons,
      share: round2(ratio * 100),
      targetShare: round2(target * 100),
      gapPp: defend ? 0 : round2(target * 100 - ratio * 100),
      opportunityTons: defend ? 0 : Math.round((target - ratio) * zone.marketTons),
      status: defend ? 'defend' : 'attack',
      clients: { total: own.length, attended, pending: own.length - attended },
    };
  });
  return zones
    .filter(zone => !onlyWithClients || zone.clients.total > 0)
    .sort((a, b) => (a.status === 'defend') - (b.status === 'defend')
      || b.opportunityTons - a.opportunityTons
      || a.department.localeCompare(b.department));
}

export function getTodayTarget(zones, capitals) {
  const zone = zones.find(item => item.status === 'attack');
  if (!zone) return null;
  const capital = capitals.find(item => item.department === zone.department);
  return {
    ...zone,
    coordinates: capital ? [capital.longitude, capital.latitude] : null,
    reason: `Brecha de ${zone.gapPp.toLocaleString('es-CO')} pp en ${zone.department}: ${tons(zone.opportunityTons)} de oportunidad y ${plural(zone.clients.pending, 'cliente', 'clientes')} por atender.`,
  };
}

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function zoneStatus(zone) {
  const chip = element('span', 'zone-status');
  chip.dataset.status = zone.status;
  chip.innerHTML = advisorIcon(zone.status === 'attack' ? 'target' : 'shield');
  chip.append(document.createTextNode(zone.status === 'attack' ? 'Atacar' : 'Defender'));
  return chip;
}

// Cifras de la zona con el formato del §14 (se usan en la lista y en la tarjeta del enfoque).
function zoneFigures(zone) {
  const { total, attended, pending } = zone.clients;
  return [
    element('p', 'zone-share', `Participación ${formatPercent(zone.share)} → ${formatPercent(zone.targetShare)}`),
    element('p', 'zone-gap', `Brecha ${zone.gapPp.toLocaleString('es-CO')} pp · Oportunidad ${tons(zone.opportunityTons)}`),
    element('p', 'zone-clients', `${plural(total, 'cliente', 'clientes')} · ${plural(attended, 'atendido', 'atendidos')} · ${pending} por atender`),
  ];
}

export function createZoneList(zones, { sample = false, onSelect = null } = {}) {
  const section = element('section', 'zone-list');
  const heading = element('h2', '', 'Oportunidad por zona');
  heading.id = `zone-list-title-${Math.random().toString(36).slice(2, 8)}`;
  section.setAttribute('aria-labelledby', heading.id);
  const head = element('div', 'zone-list-head');
  head.append(heading);
  if (sample) head.append(element('span', 'zone-sample', 'Datos de muestra'));
  // Cómo leerla, en una línea, y la clave de los dos estados.
  const note = element('p', 'zone-list-note', `Compara tu participación de mercado en cada zona con la meta del ${formatPercent(zones[0]?.targetShare ?? 10)}. Primero, las zonas con más toneladas por ganar.`);
  const legend = element('p', 'zone-list-legend');
  legend.append(zoneStatus({ status: 'attack' }), element('span', '', 'aún no llegas a la meta'), zoneStatus({ status: 'defend' }), element('span', '', 'ya la superaste: cuida tus clientes'));
  section.append(head, note, legend);
  const list = element('ol', 'zone-items');
  zones.forEach((zone, index) => {
    const item = element('li', `zone-item zone-item-${zone.status}`);
    const top = element('div', 'zone-item-top');
    const rank = element('span', 'zone-rank', String(index + 1));
    rank.setAttribute('aria-hidden', 'true');
    top.append(rank, element('h3', '', zone.department), zoneStatus(zone));
    // Barra: cuánto llevas de la meta de participación (la marca es el 100 %).
    const progress = element('div', 'zone-progress');
    const bar = element('div', 'zone-progress-bar');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', `Participación en ${zone.department}`);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(zone.targetShare));
    bar.setAttribute('aria-valuenow', String(Math.min(zone.share, zone.targetShare)));
    const fill = element('span', 'zone-progress-fill');
    fill.style.width = `${Math.min(100, zone.share / zone.targetShare * 100)}%`;
    bar.append(fill);
    progress.append(bar, element('span', 'zone-progress-label', `${formatPercent(zone.share)} de ${formatPercent(zone.targetShare)}`));
    const headline = zone.status === 'attack'
      ? element('p', 'zone-headline', `${tons(zone.opportunityTons)} por ganar`)
      : element('p', 'zone-headline zone-headline-done', 'Meta superada');
    const { total, attended, pending } = zone.clients;
    item.append(top, headline, progress,
      element('p', 'zone-clients', `${plural(total, 'cliente', 'clientes')} · ${plural(attended, 'atendido', 'atendidos')} · ${pending} por atender`));
    if (onSelect) {
      const focus = element('button', 'zone-item-focus', 'Ver en el mapa');
      focus.type = 'button';
      focus.setAttribute('aria-label', `Enfocar ${zone.department} en el mapa`);
      focus.addEventListener('click', () => onSelect(zone));
      item.append(focus);
    }
    list.append(item);
  });
  section.append(list);
  return section;
}

export function createZoneFocusCard(zone, onReset) {
  const card = element('div', 'map-glass map-zone-card');
  card.setAttribute('role', 'status');
  const top = element('div', 'zone-item-top');
  top.append(element('h3', '', zone.department), zoneStatus(zone));
  const back = element('button', 'map-zone-back', 'Ver todo');
  back.type = 'button';
  back.addEventListener('click', onReset);
  card.append(top, ...zoneFigures(zone), back);
  return card;
}

let targetCardCollapsed = false;

export function createTargetCard(target, onFocus) {
  const card = element('div', 'map-glass map-target-card');
  card.setAttribute('role', 'status');
  const icon = element('span', 'map-target-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = advisorIcon('target');
  const copy = element('div', 'map-target-copy');
  copy.append(element('h3', '', 'Zona objetivo de hoy'), element('p', 'map-target-zone', target.department), element('p', 'map-target-reason', target.reason));
  const go = element('button', 'map-target-go', 'Ver en el mapa');
  go.type = 'button';
  go.addEventListener('click', onFocus);
  // Se puede plegar para ver el mapa completo; queda solo el nombre de la zona.
  const toggle = element('button', 'map-target-toggle');
  toggle.type = 'button';
  toggle.append(element('span', 'map-heat-chevron'));
  toggle.firstChild.setAttribute('aria-hidden', 'true');
  const setCollapsed = collapsed => {
    targetCardCollapsed = collapsed;
    card.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Mostrar zona objetivo' : 'Ocultar zona objetivo');
  };
  toggle.addEventListener('click', () => setCollapsed(!targetCardCollapsed));
  setCollapsed(targetCardCollapsed);
  card.append(icon, copy, go, toggle);
  return card;
}
