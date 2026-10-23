import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GEO_LABELS, MAP_VIEW, buildAdvisorMapStyle, focusFillColor, getCityProgress, getEntrancePlan, getFeatureBounds,
  getFocusPlan, getOpportunityHeat, getTodayTarget, getZoneOpportunities, zoneHeatFilter,
} from '../src/advisor-map.js';

// Lógica del mapa de calor 3D y de la oportunidad por zona (PRD). Lo que pinta DOM se revisa en el navegador.
const capitals = JSON.parse(readFileSync(new URL('../public/data/colombia-capitals.json', import.meta.url)));
const tasks = done => Array.from({ length: 4 }, (_, index) => ({ completed: index < done }));
const heat = { type: 'FeatureCollection', features: [] };
const market = {
  sample: true,
  targetShare: 0.10,
  zones: [
    { departmentCode: '08', department: 'Atlántico', marketTons: 100000, ultracemTons: 6000 },
    { departmentCode: '13', department: 'Bolívar', marketTons: 50000, ultracemTons: 6000 },
    { departmentCode: '05', department: 'Antioquia', marketTons: 200000, ultracemTons: 18000 },
  ],
};
const clients = [
  { id: 'a', department: 'Atlántico', city: 'Barranquilla', tons_requested: 20, tasks: tasks(2) },
  { id: 'b', department: 'Atlántico', city: 'Barranquilla', tons_requested: 35, tasks: tasks(4) },
  { id: 'c', department: 'Bolívar', city: 'Cartagena de Indias', tons_requested: 40, tasks: tasks(4) },
  { id: 'd', department: 'Antioquia', city: 'Medellín', tons_requested: 30, tasks: tasks(0) },
];
const sales = [{ client_id: 'b', confirmed: true }, { client_id: 'c', confirmed: true }];

test('heat sums tons of clients without a confirmed sale, per city', () => {
  const pending = [
    { id: 'a', department: 'Atlántico', city: 'Barranquilla', tons_requested: 20 },
    { id: 'b', department: 'Atlántico', city: 'Barranquilla', tons_requested: 35 },
    { id: 'c', department: 'Antioquia', city: 'Medellín', tons_requested: 15 },
    { id: 'd', department: 'Antioquia', city: 'Medellín', tons_requested: 40 },
    { id: 'e', department: null, city: null, tons_requested: 50 },
  ];
  const result = getOpportunityHeat(pending, [{ client_id: 'c', confirmed: true }, { client_id: 'd', confirmed: false }], capitals);
  assert.equal(result.type, 'FeatureCollection');
  const byCity = Object.fromEntries(result.features.map(feature => [feature.properties.city, feature.properties]));
  assert.deepEqual(Object.keys(byCity).sort(), ['Barranquilla', 'Medellín']);
  assert.equal(byCity.Barranquilla.tons, 55);
  assert.equal(byCity.Barranquilla.weight, 1);
  assert.ok(Math.abs(byCity.Medellín.weight - 40 / 55) < 1e-9);
  const medellin = capitals.find(capital => capital.name === 'Medellín');
  const point = result.features.find(feature => feature.properties.city === 'Medellín');
  assert.deepEqual(point.geometry, { type: 'Point', coordinates: [medellin.longitude, medellin.latitude] });
  assert.deepEqual(getOpportunityHeat([], [], capitals).features, []);
});

test('zones carry share, gap, opportunity and client counts, sorted with "Defender" last', () => {
  const zones = getZoneOpportunities(market, clients, sales);
  const byName = Object.fromEntries(zones.map(zone => [zone.department, zone]));
  assert.deepEqual(zones.map(zone => zone.department), ['Atlántico', 'Antioquia', 'Bolívar']);
  assert.equal(byName['Atlántico'].share, 6);
  assert.equal(byName['Atlántico'].targetShare, 10);
  assert.equal(byName['Atlántico'].gapPp, 4);
  assert.equal(byName['Atlántico'].opportunityTons, 4000);
  assert.equal(byName['Atlántico'].status, 'attack');
  assert.equal(byName['Bolívar'].opportunityTons, 0);
  assert.equal(byName['Bolívar'].status, 'defend');
  assert.deepEqual(byName['Atlántico'].clients, { total: 2, attended: 1, pending: 1 });
  assert.deepEqual(byName['Antioquia'].clients, { total: 1, attended: 0, pending: 1 });
});

test('the advisor only sees zones with their own clients', () => {
  const own = getZoneOpportunities(market, clients.filter(client => client.department === 'Atlántico'), sales, { onlyWithClients: true });
  assert.deepEqual(own.map(zone => zone.department), ['Atlántico']);
  assert.equal(getZoneOpportunities(market, [], []).length, 3);
});

test('today target is the first "Atacar" zone, with its reason and capital', () => {
  const target = getTodayTarget(getZoneOpportunities(market, clients, sales), capitals);
  const capital = capitals.find(item => item.department === 'Atlántico');
  assert.equal(target.department, 'Atlántico');
  assert.equal(target.reason, 'Brecha de 4 pp en Atlántico: 4.000 t de oportunidad y 1 cliente por atender.');
  assert.deepEqual(target.coordinates, [capital.longitude, capital.latitude]);
  const allDefend = { ...market, zones: market.zones.map(zone => ({ ...zone, ultracemTons: zone.marketTons * 0.2 })) };
  assert.equal(getTodayTarget(getZoneOpportunities(allDefend, clients, sales), capitals), null);
});

test('city pins report task progress and turn gold only when sold', () => {
  assert.deepEqual(getCityProgress(clients.slice(0, 2), []), { percent: 75, sold: false });
  assert.deepEqual(getCityProgress([clients[2]], sales), { percent: 100, sold: true });
  assert.deepEqual(getCityProgress([clients[2]], []), { percent: 100, sold: false });
});

test('map style stacks relief and neighbors under the Colombia slab and the heat', () => {
  const style = buildAdvisorMapStyle({ activeCodes: ['08', '05'], heat, relief: true, animate: true });
  assert.deepEqual(style.layers.map(layer => layer.id), [
    'background', 'land', 'relief', 'coast-glow', 'country-glow',
    'slab-shadow', 'slab-side', 'departments-fill', 'departments-border', 'opportunity-heat',
  ]);
  assert.equal(style.layers.some(layer => layer.type === 'fill-extrusion'), false);
  assert.equal(style.sources.dem.encoding, 'terrarium');
  assert.equal(style.sources.neighbors.data, '/data/neighbors.geojson');
  assert.match(JSON.stringify(style.layers.find(layer => layer.id === 'departments-fill').paint['fill-color']), /"08","05"/);
  const heatLayer = style.layers.find(layer => layer.id === 'opportunity-heat');
  assert.equal(heatLayer.paint['heatmap-opacity'], 0);
  assert.equal(heatLayer.paint['heatmap-color'].at(-1), '#ff2d2d');
});

test('without relief the map requests nothing from the internet and shows the heat right away', () => {
  const offline = buildAdvisorMapStyle({ activeCodes: [], heat, relief: false, animate: false });
  assert.equal(offline.sources.dem, undefined);
  assert.equal(offline.layers.some(layer => layer.id === 'relief'), false);
  assert.ok(offline.layers.find(layer => layer.id === 'opportunity-heat').paint['heatmap-opacity'] > .8);
});

test('camera ends tilted and the entrance respects reduced motion', () => {
  assert.ok(MAP_VIEW.pitch >= 40);
  const plan = getEntrancePlan(false);
  assert.equal(plan.from.pitch, 0);
  assert.equal(plan.flyMs, 1200);
  assert.ok(plan.heatDelayMs + plan.heatMs <= 1600);
  const still = getEntrancePlan(true);
  assert.deepEqual([still.flyMs, still.heatMs, still.heatDelayMs, still.pinStaggerMs], [0, 0, 0, 0]);
  assert.deepEqual(getFocusPlan(false), { flyMs: 900, heatMs: 600, dimHeatOpacity: .25 });
  assert.deepEqual(getFocusPlan(true), { flyMs: 0, heatMs: 0, dimHeatOpacity: .25 });
});

test('zone focus: bounds, dimmed fill and heat filtered by department', () => {
  assert.deepEqual(getFeatureBounds({ geometry: { type: 'Polygon', coordinates: [[[-75, 10], [-74, 11], [-74.5, 10.2], [-75, 10]]] } }), [[-75, 10], [-74, 11]]);
  assert.deepEqual(getFeatureBounds({ geometry: { type: 'MultiPolygon', coordinates: [[[[-81.7, 12.5], [-81.6, 12.6], [-81.7, 12.5]]], [[[-75, 10], [-74, 11], [-75, 10]]]] } }), [[-81.7, 10], [-74, 12.6]]);
  assert.notEqual(JSON.stringify(focusFillColor(['08', '13'], '08')), JSON.stringify(focusFillColor(['08', '13'], null)));
  assert.deepEqual(zoneHeatFilter('Atlántico'), ['==', ['get', 'department'], 'Atlántico']);
  assert.ok(['Mar Caribe', 'Océano Pacífico', 'Venezuela', 'Brasil'].every(name => GEO_LABELS.some(label => label.text === name)));
});
