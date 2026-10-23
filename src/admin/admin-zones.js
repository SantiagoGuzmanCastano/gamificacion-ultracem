import { formatPercent } from '../format.js';
import { concentrationAlerts, departmentRows } from './admin-model.js';
import { bar, el, header, lightPill, marketBadge, percent, tons } from './admin-ui.js';

const COLUMNS = ['Departamento', 'Estado', 'Mercado', 'Venta Ultracem', 'Participación', 'Brecha', 'Oportunidad', 'Clientes', 'Ciudades'];

// A2 · Brecha por departamento + A3 · Cobertura por ciudad (clientes y ventas de la base).
export function renderZones(page, { market, clients, sales }) {
  const zones = departmentRows(market, clients, sales);
  const maxOpportunity = Math.max(...zones.map(zone => zone.opportunityTons), 1);
  let selected = zones.find(zone => zone.cities.length && zone.status === 'attack') ?? zones.find(zone => zone.cities.length);

  page.append(header('Brecha por zona', `Participación de cada departamento frente a la meta del ${formatPercent(zones[0]?.targetShare ?? 10)}, de mayor a menor oportunidad. Toca un departamento con clientes para ver sus ciudades.`, marketBadge(market)));

  const alerts = concentrationAlerts(zones);
  if (alerts.length) {
    const banner = el('section', 'admin-alert');
    banner.setAttribute('role', 'note');
    banner.append(el('strong', '', 'Alerta de concentración'));
    const list = el('ul');
    alerts.forEach(alert => list.append(el('li', '', `${alert.municipality} pesa ${percent(alert.ratio)} de las ventas de ${alert.department}`)));
    banner.append(list);
    page.append(banner);
  }

  const layout = el('div', 'admin-zones');
  const wrap = el('div', 'admin-table-wrap');
  const table = el('table', 'admin-table admin-zone-table');
  const headRow = el('tr');
  COLUMNS.forEach(label => headRow.append(el('th', '', label)));
  const head = el('thead');
  head.append(headRow);
  const body = el('tbody');
  table.append(head, body);
  wrap.append(table);
  const panel = el('aside', 'admin-card admin-municipalities');
  panel.setAttribute('aria-live', 'polite');
  layout.append(wrap, panel);
  page.append(layout);

  for (const zone of zones) {
    const clickable = zone.cities.length > 0;
    const tr = el('tr', clickable ? 'admin-row-clickable' : '');
    const opportunity = el('div', 'admin-compliance');
    opportunity.append(bar(zone.opportunityTons / maxOpportunity, zone.status === 'attack' ? 'red' : 'muted'), el('span', '', tons(zone.opportunityTons)));
    const clientsCell = el('div', 'admin-stack');
    clientsCell.append(el('strong', '', `${zone.clients.attended} activos`), el('span', '', `${zone.clients.pending} por cerrar`));
    const cells = [
      zone.department,
      lightPill(zone.status === 'attack' ? 'red' : 'green', zone.status === 'attack' ? 'Atacar' : 'Defender'),
      tons(zone.marketTons), tons(zone.soldTons),
      `${formatPercent(zone.share)} → ${formatPercent(zone.targetShare)}`,
      zone.gapPp ? `${zone.gapPp.toLocaleString('es-CO')} pp` : '—',
      opportunity, clientsCell,
      zone.coverage ? `${zone.coverage.withPurchase} con compra · ${zone.coverage.without} sin` : 'Sin clientes',
    ];
    cells.forEach((content, column) => {
      const td = el(column ? 'td' : 'th');
      if (!column) td.scope = 'row';
      td.dataset.label = COLUMNS[column];
      td.append(content);
      tr.append(td);
    });
    if (clickable) {
      tr.tabIndex = 0;
      tr.setAttribute('aria-label', `Ver ciudades de ${zone.department}`);
      const choose = () => { selected = zone; paintPanel(); if (window.matchMedia('(max-width: 1100px)').matches) panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      tr.addEventListener('click', choose);
      tr.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } });
    }
    tr.dataset.department = zone.department;
    body.append(tr);
  }

  function paintPanel() {
    body.querySelectorAll('tr').forEach(tr => tr.classList.toggle('selected', tr.dataset.department === selected?.department));
    if (!selected) { panel.replaceChildren(el('h2', '', 'Ciudades'), el('p', 'admin-muted', 'Aún no hay clientes asignados en ninguna zona.')); return; }
    const cover = selected.coverage;
    panel.replaceChildren(el('h2', '', `Ciudades de ${selected.department}`));
    const stats = el('dl', 'admin-figures admin-figures-compact');
    for (const [label, value] of [['Con clientes', cover.total], ['Con compra', cover.withPurchase], ['Sin compra', cover.without]]) {
      const item = el('div');
      item.append(el('dt', '', label), el('dd', '', String(value)));
      stats.append(item);
    }
    const coverageItem = el('div');
    const coverageValue = el('dd');
    coverageValue.append(percent(cover.ratio), ' ', lightPill(cover.light, cover.light === 'green' ? 'Meta 80 %' : 'Bajo 80 %'));
    coverageItem.append(el('dt', '', 'Cobertura'), coverageValue);
    stats.append(coverageItem);
    const list = el('ol', 'admin-priority');
    for (const city of selected.cities) {
      const item = el('li');
      const copy = el('div');
      copy.append(el('strong', '', city.name), el('span', '', city.reasons.join(' · ') || `${city.clients} ${city.clients === 1 ? 'cliente' : 'clientes'} con compra`));
      item.append(copy, el('span', 'admin-muted', city.hasPurchase ? tons(city.soldTons) : `${tons(city.pendingTons)} por cerrar`));
      list.append(item);
    }
    panel.append(stats, el('h3', '', 'Prioridad de visita'), list);
  }
  paintPanel();
}
