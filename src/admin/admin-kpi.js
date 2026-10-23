import { advisorRows, departmentRows, nationalKpi, progressMood, teamToday } from './admin-model.js';
import { el, header, lightPill, percent, tons } from './admin-ui.js';

// A4 · ¿Cómo vamos?: avance hacia la meta en lenguaje simple, el equipo real y qué hacer hoy.
export function renderSummary(page, { market, advisors, clients, sales, goals, navigate }) {
  const team = advisorRows(advisors, sales, clients, goals);
  const kpi = nationalKpi(market, team.length);
  const zones = departmentRows(market, clients, sales);
  const today = teamToday(zones, team);
  const mood = progressMood(kpi.progress);

  page.append(header('¿Cómo vamos?', `Avance del equipo hacia la meta: que el ${percent(kpi.targetShare)} del cemento vendido en el canal distribución sea Ultracem (ene–jul 2026).`, market.sample ? 'Mercado: cifras de referencia del PRD' : ''));

  const hero = el('section', 'admin-card admin-hero');
  const top = el('div', 'admin-hero-top');
  top.append(lightPill('green', mood), el('h2', '', `Llevamos el ${percent(kpi.progress)} del camino a la meta`));
  const track = el('div', 'admin-progress');
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', 'Avance hacia la meta de participación');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.setAttribute('aria-valuenow', String(Math.round(kpi.progress * 100)));
  const fill = el('span', 'admin-progress-fill');
  fill.style.width = `${Math.min(100, kpi.progress * 100)}%`;
  track.append(fill);
  const scale = el('div', 'admin-progress-scale');
  scale.append(el('span', '', `Hoy: ${percent(kpi.share, 2)}`), el('span', '', `Meta: ${percent(kpi.targetShare)}`));

  const facts = el('div', 'admin-facts');
  for (const [value, text] of [
    [`${(kpi.share * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} de cada 100 t`, 'de cemento que se venden en el canal ya son Ultracem.'],
    [tons(kpi.opportunityTons), `nos faltan para llegar al ${percent(kpi.targetShare)}.`],
    [kpi.perAdvisorTons == null ? 's/d' : tons(kpi.perAdvisorTons), `por asesor si los ${kpi.advisorsCount} nos repartimos lo que falta.`],
  ]) {
    const fact = el('div');
    fact.append(el('strong', '', value), el('span', '', text));
    facts.append(fact);
  }
  hero.append(top, track, scale, facts, el('p', 'admin-muted', `Mercado total del canal: ${tons(kpi.marketTons)} · Ultracem: ${tons(kpi.ultracemTons)}.`));
  page.append(hero);

  // Lo registrado en la app (Supabase).
  const confirmed = sales.filter(sale => sale.confirmed);
  const live = el('section', 'admin-card');
  const liveFigures = el('dl', 'admin-figures admin-figures-live');
  for (const [label, value] of [
    ['Asesores', team.length.toLocaleString('es-CO')],
    ['Clientes asignados', clients.length.toLocaleString('es-CO')],
    ['Ventas confirmadas', confirmed.length.toLocaleString('es-CO')],
    ['Toneladas vendidas', tons(confirmed.reduce((total, sale) => total + Number(sale.tons_sold || 0), 0))],
  ]) {
    const item = el('div');
    item.append(el('dt', '', label), el('dd', '', value));
    liveFigures.append(item);
  }
  live.append(el('h2', '', 'Equipo en la app'), liveFigures);
  page.append(live);

  const answers = el('section', 'admin-answers');
  for (const [title, text] of [['Dónde crecer', today.where], ['Quién necesita apoyo', today.who], ['Qué hacer hoy', today.what]]) {
    const card = el('article', 'admin-card admin-answer');
    card.append(el('h2', '', title), el('p', '', text));
    answers.append(card);
  }
  page.append(answers);

  const tops = el('section', 'admin-tops');
  tops.append(
    topList('Asesores con más camino por recorrer', team.slice(0, 3).map(row => [row.name, `${tons(row.soldTons)} de ${tons(row.goalTons)}`, `${percent(row.compliance)} de su meta`]), 'Ver asesores', () => navigate('team')),
    topList('Zonas con más espacio para crecer', zones.filter(zone => zone.status === 'attack').slice(0, 3).map(zone => [zone.department, `Hoy ${zone.share.toLocaleString('es-CO')} % · meta ${zone.targetShare.toLocaleString('es-CO')} %`, `${tons(zone.opportunityTons)} por ganar`]), 'Ver zonas', () => navigate('zones')),
  );
  page.append(tops);
}

function topList(title, rows, linkLabel, onLink) {
  const card = el('article', 'admin-card admin-top');
  card.append(el('h2', '', title));
  const list = el('ol');
  for (const [name, detail, aside] of rows) {
    const item = el('li');
    const copy = el('div');
    copy.append(el('strong', '', name), el('span', '', detail));
    item.append(copy, el('span', 'admin-top-aside', aside));
    list.append(item);
  }
  if (!rows.length) list.append(el('li', 'admin-muted', 'Sin datos todavía.'));
  const link = el('button', 'admin-link', `${linkLabel} →`);
  link.type = 'button';
  link.addEventListener('click', onLink);
  card.append(list, link);
  return card;
}
