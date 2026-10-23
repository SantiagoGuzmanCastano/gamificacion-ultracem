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

export function createZoneList(zones, { sample = false } = {}) {
  const section = element('section', 'zone-list');
  const heading = element('h2', '', 'Oportunidad por zona');
  heading.id = `zone-list-title-${Math.random().toString(36).slice(2, 8)}`;
  section.setAttribute('aria-labelledby', heading.id);
  const head = element('div', 'zone-list-head');
  head.append(heading);
  if (sample) head.append(element('span', 'zone-sample', 'Datos de muestra'));
  section.append(head, element('p', 'zone-list-note', 'De mayor a menor oportunidad; las zonas en "Defender" van al final.'));
  const list = element('ol', 'zone-items');
  for (const zone of zones) {
    const item = element('li', `zone-item zone-item-${zone.status}`);
    const top = element('div', 'zone-item-top');
    const chip = element('span', 'zone-status');
    chip.dataset.status = zone.status;
    chip.innerHTML = advisorIcon(zone.status === 'attack' ? 'target' : 'shield');
    chip.append(document.createTextNode(zone.status === 'attack' ? 'Atacar' : 'Defender'));
    top.append(element('h3', '', zone.department), chip);
    const { total, attended, pending } = zone.clients;
    item.append(
      top,
      element('p', 'zone-share', `Participación ${formatPercent(zone.share)} → ${formatPercent(zone.targetShare)}`),
      element('p', 'zone-gap', `Brecha ${zone.gapPp.toLocaleString('es-CO')} pp · Oportunidad ${tons(zone.opportunityTons)}`),
      element('p', 'zone-clients', `${plural(total, 'cliente', 'clientes')} · ${plural(attended, 'atendido', 'atendidos')} · ${pending} por atender`),
    );
    list.append(item);
  }
  section.append(list);
  return section;
}

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
  card.append(icon, copy, go);
  return card;
}
