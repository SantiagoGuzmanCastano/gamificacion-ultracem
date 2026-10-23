import { getZoneOpportunities } from '../zone-opportunity.js';

// PRD · vista del administrador (A1–A5). Solo cálculos: sin DOM, para poder probarlos.
// Asesores, clientes y ventas vienen de Supabase; el mercado por zona, de zone-market.json (no hay otra fuente).
export const DEFAULT_GOAL = { market_tons: 1000, target_share: 0.10, target_clients: 50 };
export const TEAM_MONTHLY_GOAL_TONS = 55000;
const COVERAGE_TARGET = 0.8;
const CONCENTRATION_LIMIT = 0.65;

export function shareLight(share) {
  return share >= 0.10 ? 'green' : share >= 0.08 ? 'yellow' : 'red';
}

export function complianceLight(ratio) {
  if (ratio >= 1) return { light: 'green', label: 'Cumple' };
  if (ratio >= 0.8) return { light: 'yellow', label: 'En riesgo' };
  return { light: 'red', label: 'Crítico' };
}

// Oportunidad = (objetivo − actual) × mercado.
export function nationalKpi(market, advisorsCount) {
  const marketTons = market.zones.reduce((total, zone) => total + zone.marketTons, 0);
  const ultracemTons = market.zones.reduce((total, zone) => total + zone.ultracemTons, 0);
  const targetShare = market.targetShare ?? 0.10;
  const share = ultracemTons / marketTons;
  const opportunityTons = Math.max(0, Math.round((targetShare - share) * marketTons));
  return {
    marketTons, ultracemTons, share, targetShare, opportunityTons,
    targetTons: Math.round(marketTons * targetShare),
    gapPp: Math.max(0, (targetShare - share) * 100),
    progress: share / targetShare,
    advisorsCount,
    perAdvisorTons: advisorsCount ? Math.round(opportunityTons / advisorsCount) : null,
    light: shareLight(share),
  };
}

// El Resumen cuenta el avance en positivo: siempre dice cuánto camino llevamos.
export function progressMood(progress) {
  if (progress >= 1) return 'Meta cumplida';
  if (progress >= 0.9) return '¡Casi llegamos!';
  if (progress >= 0.6) return 'Vamos bien';
  return 'En camino';
}

export function goalTons(goal) {
  return Math.round(Number(goal.market_tons) * Number(goal.target_share));
}

// Recalcula una fila con su meta; se usa al cargar y al editar la meta (A5).
export function withGoal(row, goal) {
  const target = goalTons(goal);
  const compliance = target ? row.soldTons / target : 0;
  return {
    ...row,
    goal,
    goalTons: target,
    targetShare: Number(goal.target_share),
    targetClients: Number(goal.target_clients),
    compliance,
    gapTons: Math.max(0, target - row.soldTons),
    clientGap: Math.max(0, Number(goal.target_clients) - row.activeClients),
    avgOrder: row.activeClients ? Math.round(row.soldTons / row.activeClients) : null,
    requiredAvgOrder: Math.round(target / Number(goal.target_clients)),
    ...complianceLight(compliance),
  };
}

const confirmedOf = sales => sales.filter(sale => sale.confirmed);
const sumTons = list => list.reduce((total, sale) => total + Number(sale.tons_sold || 0), 0);

export function advisorRows(realAdvisors, sales, clients, goals = []) {
  const confirmed = confirmedOf(sales);
  const rows = realAdvisors.filter(advisor => advisor.role !== 'admin').map(advisor => {
    const own = confirmed.filter(sale => sale.advisor_id === advisor.user_id);
    const assigned = clients.filter(client => client.advisor_id === advisor.user_id);
    const active = new Set(own.map(sale => sale.client_id));
    return withGoal({
      key: advisor.user_id,
      name: advisor.full_name,
      departments: [...new Set(assigned.map(client => client.department).filter(Boolean))],
      soldTons: sumTons(own),
      assignedClients: assigned.length,
      activeClients: active.size,
      // En el MVP todos los clientes se crean en la app durante el periodo: los activos son nuevos.
      newClients: active.size,
      // La base aún no registra clientes recuperados: se muestra "s/d", nunca un número inventado.
      recoveredClients: null,
    }, goals.find(goal => goal.advisor_key === advisor.user_id) ?? DEFAULT_GOAL);
  });
  return sortAdvisors(rows);
}

// Más atrasado primero (mayor brecha en toneladas); `ahead` invierte el orden.
export function sortAdvisors(rows, ahead = false) {
  return [...rows].sort((a, b) => ahead ? b.compliance - a.compliance : b.gapTons - a.gapTons || a.compliance - b.compliance);
}

// A3 con lo que hay en la base: ciudades con clientes de la zona, con o sin compra confirmada.
export function cityRows(department, clients, sales) {
  const confirmed = confirmedOf(sales);
  const sold = new Set(confirmed.map(sale => sale.client_id));
  const cities = new Map();
  for (const client of clients.filter(item => item.department === department && item.city)) {
    const city = cities.get(client.city) ?? { name: client.city, clients: 0, soldTons: 0, pendingClients: 0, pendingTons: 0 };
    city.clients += 1;
    if (sold.has(client.id)) city.soldTons += sumTons(confirmed.filter(sale => sale.client_id === client.id));
    else { city.pendingClients += 1; city.pendingTons += Number(client.tons_requested || 0); }
    cities.set(client.city, city);
  }
  return [...cities.values()].map(city => {
    const hasPurchase = city.soldTons > 0;
    const reasons = [];
    if (!hasPurchase) reasons.push('Sin compra');
    if (city.pendingClients) reasons.push(`${city.pendingClients} ${city.pendingClients === 1 ? 'cliente' : 'clientes'} por cerrar`);
    return { ...city, hasPurchase, reasons, score: (hasPurchase ? 0 : 8) + (city.pendingClients ? 2 : 0) };
  }).sort((a, b) => b.score - a.score || b.pendingTons - a.pendingTons || a.name.localeCompare(b.name));
}

export function coverage(cities) {
  const total = cities.length;
  const withPurchase = cities.filter(city => city.hasPurchase).length;
  const ratio = total ? withPurchase / total : 0;
  return { total, withPurchase, without: total - withPurchase, ratio, light: ratio >= COVERAGE_TARGET ? 'green' : ratio >= 0.6 ? 'yellow' : 'red' };
}

// A2: mercado de zone-market.json + clientes y ventas reales de cada departamento.
export function departmentRows(market, clients, sales) {
  return getZoneOpportunities(market, clients, sales).map(zone => {
    const cities = cityRows(zone.department, clients, sales);
    return { ...zone, cities, coverage: cities.length ? coverage(cities) : null };
  });
}

// Solo tiene sentido si el departamento vende en más de una ciudad.
export function concentrationAlerts(departments) {
  return departments.flatMap(zone => {
    const selling = zone.cities.filter(city => city.soldTons > 0);
    if (selling.length < 2) return [];
    const total = selling.reduce((sum, city) => sum + city.soldTons, 0);
    const top = selling.reduce((best, city) => city.soldTons > best.soldTons ? city : best);
    const ratio = top.soldTons / total;
    return ratio > CONCENTRATION_LIMIT ? [{ department: zone.department, municipality: top.name, ratio }] : [];
  });
}

const tons = value => `${Math.round(value).toLocaleString('es-CO')} t`;

// A4: ¿dónde?, ¿quién? y ¿qué hacer hoy?, en frases cortas y sin regaño.
export function teamToday(departments, advisors) {
  const attack = departments.filter(item => item.status === 'attack');
  const zone = attack.find(item => item.clients.pending > 0) ?? attack[0];
  const critical = advisors.filter(row => row.light === 'red');
  const first = critical[0] ?? advisors[0];
  return {
    where: zone
      ? `${zone.department}: ${tons(zone.opportunityTons)} por ganar${zone.clients.pending ? ` y ${zone.clients.pending} ${zone.clients.pending === 1 ? 'cliente' : 'clientes'} por cerrar` : ''}.`
      : 'Todas las zonas superan la meta: toca defender clientes.',
    who: !advisors.length
      ? 'Aún no hay asesores registrados.'
      : critical.length
        ? `${critical.length} de ${advisors.length} asesores necesitan un empujón. ${first.name} tiene más camino por recorrer: le faltan ${tons(first.gapTons)}.`
        : 'Todo el equipo va encaminado. Buen momento para acompañar a quienes están cerca de su meta.',
    what: first
      ? `Acompañar a ${first.name} a sumar ${first.clientGap} clientes activos${zone ? ` y abrir clientes en ${zone.department}` : ''}.`
      : 'Crear cuentas de asesor y asignarles clientes en las zonas para atacar.',
  };
}
