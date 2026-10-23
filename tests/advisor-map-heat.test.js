import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COLUMN_COLOR, COLUMN_LAYERS, GEO_LABELS, getDepartmentHoverTip, hoverLift, getColumnPoints, getDepartmentRadiusKm, lockedZoneMessage, columnLevel, easeOutBack, SOLD_FILTER, MAP_VIEW, buildAdvisorMapStyle, focusColumnColor, focusFillColor, getCityProgress, getEntrancePlan,
  getCityTonnage, getFeatureBounds, getFocusPlan, getOpportunityColumns, getOpportunityHeat, getTodayTarget, getZoneOpportunities, zoneHeatFilter,
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
    'slab-shadow', 'slab-side', 'departments-fill', 'departments-border', 'department-hover', 'opportunity-heat', 'column-halo', 'sold-glow', 'sold-ring', ...COLUMN_LAYERS,
  ]);
  // Columnas gruesas para leer el país y finas al acercarse; arrancan en altura 0 para crecer en la entrada.
  const [wide, fine] = COLUMN_LAYERS.map(id => style.layers.find(layer => layer.id === id));
  assert.equal(wide.type, 'fill-extrusion');
  assert.equal(wide.maxzoom, fine.minzoom);
  assert.deepEqual(wide.filter, ['==', ['get', 'lod'], 'wide']);
  assert.deepEqual(wide.paint['fill-extrusion-height'], columnLevel('top', { sold: 0, pending: 0 }));
  assert.deepEqual(['sold-glow', 'sold-ring'].map(id => style.layers.find(layer => layer.id === id).filter), [SOLD_FILTER, SOLD_FILTER]);
  assert.equal(style.layers.find(layer => layer.id === 'column-halo').paint['circle-opacity'], 0);
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
  assert.ok(offline.layers.find(layer => layer.id === 'opportunity-heat').paint['heatmap-opacity'] > .4);
  const height = offline.layers.find(layer => layer.id === 'opportunity-columns').paint['fill-extrusion-height'];
  // De lejos la altura completa; de cerca, más baja para no tapar la zona.
  assert.deepEqual(height, columnLevel('top'));
  assert.equal(height[4][2], 1);
  assert.ok(height.at(-1)[2] < .2);
});

test('city tonnage splits sold (confirmed sales) from pending tons', () => {
  const tonnage = getCityTonnage(clients, [...sales.slice(0, 1), { client_id: 'c', confirmed: true, tons_sold: 38 }], capitals);
  const byCity = Object.fromEntries(tonnage.map(city => [city.city, city]));
  assert.equal(byCity.Barranquilla.soldTons, 35);
  assert.equal(byCity.Barranquilla.pendingTons, 20);
  assert.equal(byCity['Cartagena de Indias'].soldTons, 38);
  assert.equal(byCity['Cartagena de Indias'].pendingTons, 0);
  assert.equal(byCity.Medellín.pendingTons, 30);
});

test('columns stack a gold sold base, the pending tons and a bright cap, as closed cylinders', () => {
  const columns = getOpportunityColumns(getCityTonnage(clients, sales, capitals), { sides: 12, maxHeight: 1000 });
  const barranquilla = columns.features.filter(feature => feature.properties.city === 'Barranquilla' && feature.properties.lod === 'wide');
  const piece = kind => barranquilla.find(feature => feature.properties.kind === kind).properties;
  assert.equal(piece('sold').base, 0);
  assert.ok(Math.abs(piece('sold').top - 1000 * 35 / 55) < 1e-9);
  assert.equal(piece('pending').base, piece('sold').top);
  assert.equal(piece('pending').top, piece('cap').base);
  assert.ok(Math.abs(piece('cap').top - 1000) < 1e-9);
  assert.equal(piece('cap').tone, 'pending');
  const ring = barranquilla[0].geometry.coordinates[0];
  assert.equal(ring.length, 13);
  assert.deepEqual(ring[0], ring.at(-1));
  const capital = capitals.find(item => item.name === 'Barranquilla');
  assert.ok(ring.every(([x, y]) => Math.abs(x - capital.longitude) < .5 && Math.abs(y - capital.latitude) < .5));
  // Una ciudad toda vendida sigue teniendo columna: dorada con tapa dorada clara.
  const cartagena = columns.features.filter(feature => feature.properties.city === 'Cartagena de Indias' && feature.properties.lod === 'wide');
  assert.deepEqual(cartagena.map(feature => [feature.properties.kind, feature.properties.tone]), [['sold', undefined], ['cap', 'sold']]);
  assert.ok(columns.features.filter(feature => feature.properties.kind === 'cap').every(feature => feature.properties.top >= 100));
  assert.deepEqual(getOpportunityColumns([]).features, []);
});

test('small departments get thinner columns than large ones', () => {
  const tonnage = getCityTonnage(clients, sales, capitals);
  const departments = { 'Atlántico': 30, 'Antioquia': 140 };
  const columns = getOpportunityColumns(tonnage, { radiusFor: city => departments[city.department] || 140 });
  const width = (city, lod) => {
    const ring = columns.features.find(feature => feature.properties.city === city && feature.properties.lod === lod).geometry.coordinates[0];
    return Math.max(...ring.map(([, y]) => y)) - Math.min(...ring.map(([, y]) => y));
  };
  assert.ok(width('Barranquilla', 'fine') < width('Medellín', 'fine'));
  assert.ok(width('Barranquilla', 'fine') < width('Barranquilla', 'wide'));
});

test('department size is measured as an equivalent radius in km', () => {
  // Un cuadrado de 1° x 1° en el ecuador mide unos 111 x 111 km.
  const square = { geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } };
  assert.ok(Math.abs(getDepartmentRadiusKm(square) - Math.sqrt(111.32 * 110.57 / Math.PI)) < 1);
  const two = { geometry: { type: 'MultiPolygon', coordinates: [square.geometry.coordinates, [[[5, 0], [6, 0], [6, 1], [5, 1], [5, 0]]]] } };
  assert.ok(getDepartmentRadiusKm(two) > getDepartmentRadiusKm(square));
});

test('halo points carry the color of their column', () => {
  const points = getColumnPoints(getCityTonnage(clients, sales, capitals)).features;
  const kind = city => points.find(point => point.properties.city === city).properties.kind;
  assert.equal(kind('Cartagena de Indias'), 'sold');
  assert.equal(kind('Medellín'), 'pending');
});

test('locked zones explain how to unlock them, game style', () => {
  const message = lockedZoneMessage('Chocó');
  assert.equal(message.title, 'Chocó · Zona sin explorar');
  assert.match(message.body, /Aún no has explorado esta zona/);
  assert.match(message.body, /cliente nuevo/);
  assert.match(message.reward, /\+40 XP/);
});

test('focusing a zone keeps its columns colored and dims the rest', () => {
  assert.equal(focusColumnColor(null), COLUMN_COLOR);
  const focused = focusColumnColor('Atlántico');
  assert.deepEqual(focused.slice(0, 2), ['case', ['==', ['get', 'department'], 'Atlántico']]);
  assert.equal(focused[2], COLUMN_COLOR);
});

test('camera ends tilted and the entrance respects reduced motion', () => {
  assert.ok(MAP_VIEW.pitch >= 50);
  const plan = getEntrancePlan(false);
  assert.equal(plan.from.pitch, 0);
  assert.equal(plan.flyMs, 1200);
  assert.ok(plan.heatDelayMs + plan.heatMs <= 1600);
  const still = getEntrancePlan(true);
  // Lo vendido crece primero; lo pendiente, cuando lo dorado ya casi se asentó.
  assert.ok(plan.pendingDelayMs > plan.columnDelayMs);
  assert.ok(plan.pendingDelayMs + plan.pendingMs <= 2200);
  assert.deepEqual([still.flyMs, still.heatMs, still.heatDelayMs, still.columnMs, still.pendingMs, still.pinStaggerMs], [0, 0, 0, 0, 0, 0]);
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

test('hovered department lifts a little and the tooltip says its state in words', () => {
  const style = buildAdvisorMapStyle({ activeCodes: [], heat, relief: false });
  const hover = style.layers.find(layer => layer.id === 'department-hover');
  assert.equal(hover.type, 'fill-extrusion');
  assert.deepEqual(hover.filter, ['==', ['get', 'divipola_dep'], '']);
  const lift = hoverLift(1);
  assert.ok(lift[4] > lift.at(-1));
  assert.deepEqual(getDepartmentHoverTip('Vichada', 0), { title: 'Vichada', detail: 'Sin explorar · toca para ver cómo desbloquearla', locked: true });
  assert.deepEqual(getDepartmentHoverTip('Antioquia', 1), { title: 'Antioquia', detail: '1 cliente · toca para enfocar', locked: false });
});

test('gold and pending parts grow separately and the hovered department lifts its columns', () => {
  // A zoom 4 (factor 1) con lo vendido crecido y lo pendiente en 0, la punta queda en el piso dorado.
  const atFour = expression => expression[4];
  const half = columnLevel('top', { sold: 1, pending: 0 });
  assert.deepEqual(atFour(half), ['*', ['+', ['*', ['min', ['get', 'top'], ['get', 'floor']], 1], ['*', ['max', ['-', ['get', 'top'], ['get', 'floor']], 0], 0]], 1]);
  // En hover, las columnas del departamento suben lo mismo que él.
  const lifted = atFour(columnLevel('base', { department: 'Atlántico', lift: 1 }));
  assert.equal(lifted[0], '+');
  assert.deepEqual(lifted[2], ['case', ['==', ['get', 'department'], 'Atlántico'], hoverLift(1)[4], 0]);
  assert.equal(columnLevel('base', { department: 'Atlántico', lift: 0 })[4][0], '*');
  const pieces = getOpportunityColumns(getCityTonnage(clients, sales, capitals)).features.filter(feature => feature.properties.city === 'Barranquilla');
  assert.ok(pieces.every(feature => feature.properties.floor === pieces.find(piece => piece.properties.kind === 'sold').properties.top));
});

test('the gold pop overshoots a little and settles at full height', () => {
  assert.ok(Math.abs(easeOutBack(0)) < 1e-9);
  assert.ok(Math.abs(easeOutBack(1) - 1) < 1e-9);
  assert.ok(Math.max(...Array.from({ length: 20 }, (_, index) => easeOutBack(index / 20))) > 1);
});
