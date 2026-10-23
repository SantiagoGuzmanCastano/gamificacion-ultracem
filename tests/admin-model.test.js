import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  shareLight, complianceLight, nationalKpi, goalTons, withGoal, advisorRows, sortAdvisors,
  cityRows, departmentRows, concentrationAlerts, teamToday, progressMood,
} from '../src/admin/admin-model.js';

const market = JSON.parse(readFileSync(new URL('../public/data/zone-market.json', import.meta.url)));
const advisors = [
  { user_id: 'u1', full_name: 'Ana', role: 'advisor' },
  { user_id: 'u2', full_name: 'Beto', role: 'advisor' },
  { user_id: 'a1', full_name: 'Admin', role: 'admin' },
];
const clients = [
  { id: 'c1', advisor_id: 'u1', department: 'Bolívar', city: 'Cartagena de Indias', tons_requested: 40 },
  { id: 'c2', advisor_id: 'u1', department: 'Bolívar', city: 'Magangué', tons_requested: 25 },
  { id: 'c3', advisor_id: 'u2', department: 'Atlántico', city: 'Barranquilla', tons_requested: 120 },
  { id: 'c4', advisor_id: 'u2', department: 'Atlántico', city: 'Soledad', tons_requested: 10 },
];
const sales = [
  { advisor_id: 'u1', client_id: 'c1', tons_sold: 40, confirmed: true },
  { advisor_id: 'u2', client_id: 'c3', tons_sold: 120, confirmed: true },
  { advisor_id: 'u2', client_id: 'c4', tons_sold: 10, confirmed: true },
  { advisor_id: 'u1', client_id: 'c2', tons_sold: 99, confirmed: false },
];

test('semáforos en los bordes del PRD', () => {
  assert.deepEqual([0.0799, 0.08, 0.0999, 0.10].map(shareLight), ['red', 'yellow', 'yellow', 'green']);
  assert.deepEqual([0.79, 0.8, 0.99, 1].map(ratio => complianceLight(ratio).label), ['Crítico', 'En riesgo', 'En riesgo', 'Cumple']);
});

test('KPI nacional cuadra con el PRD', () => {
  const kpi = nationalKpi(market, 18);
  assert.equal(kpi.marketTons, 4653177);
  assert.equal((kpi.share * 100).toFixed(2), '7.83');
  assert.ok(Math.abs(kpi.opportunityTons - 100996) <= 1);
  assert.equal(kpi.perAdvisorTons, 5611);
  assert.equal(kpi.gapPp.toFixed(2), '2.17');
  assert.equal(kpi.light, 'red');
  assert.equal(nationalKpi(market, 0).perAdvisorTons, null);
});

test('la meta se recalcula al cambiar participación o clientes objetivo', () => {
  const base = { key: 'x', soldTons: 80, activeClients: 10 };
  assert.equal(goalTons({ market_tons: 1000, target_share: 0.1 }), 100);
  const before = withGoal(base, { market_tons: 1000, target_share: 0.1, target_clients: 50 });
  assert.equal(before.goalTons, 100);
  assert.equal(before.label, 'En riesgo');
  const after = withGoal(base, { market_tons: 1000, target_share: 0.07, target_clients: 20 });
  assert.equal(after.goalTons, 70);
  assert.equal(after.label, 'Cumple');
  assert.equal(after.gapTons, 0);
  assert.equal(after.clientGap, 10);
  assert.equal(after.requiredAvgOrder, 4);
});

test('asesores reales con ventas confirmadas, del más atrasado al más adelantado', () => {
  const rows = advisorRows(advisors, sales, clients);
  assert.deepEqual(rows.map(row => row.name), ['Ana', 'Beto']);
  const [ana, beto] = rows;
  assert.equal(ana.soldTons, 40);
  assert.equal(ana.activeClients, 1);
  assert.equal(ana.assignedClients, 2);
  assert.equal(ana.recoveredClients, null);
  assert.deepEqual(ana.departments, ['Bolívar']);
  assert.equal(ana.label, 'Crítico');
  assert.equal(beto.label, 'Cumple');
  assert.equal(sortAdvisors(rows, true)[0].name, 'Beto');
});

test('una meta guardada reemplaza la de por defecto', () => {
  const rows = advisorRows(advisors, sales, clients, [{ advisor_key: 'u1', market_tons: 1000, target_share: 0.04, target_clients: 5 }]);
  const ana = rows.find(row => row.key === 'u1');
  assert.equal(ana.goalTons, 40);
  assert.equal(ana.label, 'Cumple');
});

test('departamentos: defender al final con oportunidad 0 y ciudades reales', () => {
  const rows = departmentRows(market, clients, sales);
  const atlantico = rows.find(row => row.department === 'Atlántico');
  assert.equal(atlantico.status, 'defend');
  assert.equal(atlantico.opportunityTons, 0);
  const firstDefend = rows.findIndex(row => row.status === 'defend');
  assert.ok(rows.slice(firstDefend).every(row => row.status === 'defend'));
  const bolivar = rows.find(row => row.department === 'Bolívar');
  assert.deepEqual(bolivar.coverage, { total: 2, withPurchase: 1, without: 1, ratio: 0.5, light: 'red' });
  assert.equal(rows.find(row => row.department === 'Antioquia').coverage, null);
});

test('ciudades: sin compra y con clientes por cerrar primero', () => {
  const [first, second] = cityRows('Bolívar', clients, sales);
  assert.equal(first.name, 'Magangué');
  assert.deepEqual(first.reasons, ['Sin compra', '1 cliente por cerrar']);
  assert.equal(first.pendingTons, 25);
  assert.equal(second.soldTons, 40);
});

test('alerta de concentración solo si se vende en varias ciudades', () => {
  const alerts = concentrationAlerts(departmentRows(market, clients, sales));
  assert.deepEqual(alerts.map(alert => alert.municipality), ['Barranquilla']);
});

test('qué hacer hoy nombra zona y asesor', () => {
  const today = teamToday(departmentRows(market, clients, sales), advisorRows(advisors, sales, clients));
  assert.match(today.where, /Bolívar/);
  assert.match(today.who, /1 de 2 asesores necesitan un empujón\. Ana/);
  assert.match(today.what, /Ana/);
  assert.match(teamToday([], []).who, /no hay asesores/);
});

test('el resumen cuenta el avance en positivo', () => {
  assert.deepEqual([0.3, 0.6, 0.783, 0.9, 1].map(progressMood), ['En camino', 'Vamos bien', 'Vamos bien', '¡Casi llegamos!', 'Meta cumplida']);
});

test('prospectos: el de más volumen de cada departamento va primero', async () => {
  const { topProspects } = await import('../src/advisor-map.js');
  const data = JSON.parse(readFileSync(new URL('../public/data/prospects.json', import.meta.url)));
  const capitals = JSON.parse(readFileSync(new URL('../public/data/colombia-capitals.json', import.meta.url)));
  for (const capital of capitals) {
    const list = topProspects(data.prospects, capital.department);
    assert.ok(list.length >= 1, capital.department);
    assert.ok(list[0].estimatedTons >= list.at(-1).estimatedTons);
    assert.match(list[0].phone, /^\+57 300 000 \d{4}$/);
    assert.match(list[0].website, /\.example$/);
  }
});
