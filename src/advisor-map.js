import { createTargetCard, createZoneFocusCard, getTodayTarget } from './zone-opportunity.js';
import { getXp } from './game.js';

export { createTargetCard, createZoneFocusCard, createZoneList, getTodayTarget, getZoneOpportunities } from './zone-opportunity.js';

let map;
let hoverPopup;
let detailPopup;
let markers = [];
let warningNode;
let overlays = [];
let generation = 0;

export function getDepartmentClientStates(clients, capitals) {
  const states = new Map(capitals.map(capital => [capital.departmentCode, {
    name: capital.department,
    clients: [],
  }]));
  for (const client of clients) {
    const state = capitals.find(capital => capital.department === client.department);
    if (state) states.get(state.departmentCode).clients.push(client);
  }
  return states;
}

export function groupCityClients(clients, capitals) {
  const groups = new Map();
  const warnings = [];
  for (const client of clients) {
    const capital = capitals.find(item => item.department === client.department && item.name === client.city);
    if (!capital || !Number.isFinite(capital.longitude) || !Number.isFinite(capital.latitude)) {
      warnings.push(client);
      continue;
    }
    const key = `${capital.departmentCode}:${capital.name}`;
    if (!groups.has(key)) groups.set(key, {
      city: capital.name,
      department: capital.department,
      coordinates: [capital.longitude, capital.latitude],
      clients: [],
    });
    groups.get(key).clients.push(client);
  }
  return { groups: [...groups.values()], warnings };
}

// Mapa de calor de oportunidad: toneladas pedidas por clientes sin venta confirmada, por ciudad.
export function getOpportunityHeat(clients, sales, capitals) {
  const sold = new Set(sales.filter(sale => sale.confirmed).map(sale => sale.client_id));
  const pending = clients.filter(client => !sold.has(client.id) && Number(client.tons_requested) > 0);
  const points = groupCityClients(pending, capitals).groups.map(group => ({
    city: group.city,
    department: group.department,
    coordinates: group.coordinates,
    tons: group.clients.reduce((total, client) => total + Number(client.tons_requested), 0),
  }));
  const max = Math.max(0, ...points.map(point => point.tons));
  return {
    type: 'FeatureCollection',
    features: points.map(point => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: point.coordinates },
      properties: { city: point.city, department: point.department, tons: point.tons, weight: point.tons / max },
    })),
  };
}

// Toneladas por ciudad: lo vendido (ventas confirmadas) y lo que falta por vender.
export function getCityTonnage(clients, sales, capitals) {
  const confirmed = new Map(sales.filter(sale => sale.confirmed).map(sale => [sale.client_id, sale]));
  return groupCityClients(clients, capitals).groups.map(group => {
    let soldTons = 0, pendingTons = 0;
    for (const client of group.clients) {
      const sale = confirmed.get(client.id);
      if (sale) soldTons += Number(sale.tons_sold || client.tons_requested || 0);
      else pendingTons += Number(client.tons_requested || 0);
    }
    return { city: group.city, department: group.department, coordinates: group.coordinates, soldTons, pendingTons };
  }).filter(city => city.soldTons + city.pendingTons > 0);
}

function circle([lng, lat], radiusKm, sides) {
  const dLng = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));
  const dLat = radiusKm / 110.57;
  const ring = Array.from({ length: sides }, (_, index) => {
    const angle = index / sides * Math.PI * 2;
    return [lng + Math.cos(angle) * dLng, lat + Math.sin(angle) * dLat];
  });
  ring.push(ring[0]);
  return ring;
}

// Tamaño de un departamento como radio equivalente (km): sirve para que las columnas de los
// departamentos pequeños (Quindío, Atlántico, Bogotá) no se salgan de su territorio.
export function getDepartmentRadiusKm(feature) {
  const { type, coordinates } = feature.geometry;
  const outers = type === 'MultiPolygon' ? coordinates.map(polygon => polygon[0]) : [coordinates[0]];
  let area = 0;
  for (const ring of outers) {
    const lat = ring.reduce((total, [, y]) => total + y, 0) / ring.length;
    const kx = 111.32 * Math.cos(lat * Math.PI / 180), ky = 110.57;
    let sum = 0;
    for (let index = 0; index < ring.length - 1; index++) {
      const [x1, y1] = ring[index], [x2, y2] = ring[index + 1];
      sum += x1 * kx * y2 * ky - x2 * kx * y1 * ky;
    }
    area += Math.abs(sum) / 2;
  }
  return Math.sqrt(area / Math.PI);
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
// Dos niveles de detalle: columnas gruesas para leer el país y finas al acercarse a una zona.
export const COLUMN_LOD = {
  wide: { share: .45, min: 11, max: 28 },
  fine: { share: .16, min: 2.5, max: 11 },
};

// Columnas 3D apiladas por ciudad: base dorada con lo vendido, encima lo que falta en color de calor
// y una tapa clara que brilla. La altura total sigue las toneladas; la mínima deja ver las ciudades pequeñas.
export function getOpportunityColumns(cities, { radiusFor = () => 40, sides = 32, maxHeight = 380000, minShare = .1 } = {}) {
  const maxTotal = Math.max(0, ...(cities || []).map(city => city.soldTons + city.pendingTons));
  const maxPending = Math.max(0, ...(cities || []).map(city => city.pendingTons));
  const features = [];
  for (const city of cities || []) {
    const total = city.soldTons + city.pendingTons;
    const unit = Math.max(total / maxTotal, minShare) * maxHeight / total;
    const soldTop = city.soldTons * unit, top = total * unit;
    const capBase = top * .955;
    const props = { city: city.city, department: city.department };
    const pendingWeight = maxPending ? city.pendingTons / maxPending : 0;
    for (const [lod, sizing] of Object.entries(COLUMN_LOD)) {
      const ring = circle(city.coordinates, clamp(radiusFor(city) * sizing.share, sizing.min, sizing.max), sides);
      const piece = properties => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { ...props, lod, ...properties } });
      if (city.soldTons > 0) features.push(piece({ kind: 'sold', tons: city.soldTons, weight: 1, base: 0, top: Math.min(soldTop, capBase) }));
      if (city.pendingTons > 0) features.push(piece({ kind: 'pending', tons: city.pendingTons, weight: pendingWeight, base: Math.min(soldTop, capBase), top: capBase }));
      features.push(piece({ kind: 'cap', tone: city.pendingTons > 0 ? 'pending' : 'sold', tons: total, weight: pendingWeight, base: capBase, top }));
    }
  }
  return { type: 'FeatureCollection', features };
}

// Punto por ciudad para el halo del piso (mismo color que su columna).
export function getColumnPoints(cities) {
  const maxPending = Math.max(0, ...(cities || []).map(city => city.pendingTons));
  return {
    type: 'FeatureCollection',
    features: (cities || []).map(city => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: city.coordinates },
      properties: { city: city.city, department: city.department, kind: city.pendingTons > 0 ? 'pending' : 'sold', weight: maxPending ? city.pendingTons / maxPending : 0 },
    })),
  };
}

// Lo vendido va en dorado (como los pines vendidos); lo pendiente, en la rampa azul→rojo del calor;
// la tapa es una versión clara del tramo de arriba.
const SOLD_COLOR = '#ffc928';
const HEAT_RAMP = ['interpolate', ['linear'], ['get', 'weight'], 0, '#1450ff', .25, '#00c2ff', .45, '#3cff9a', .65, '#ffe14d', .82, '#ff8a1f', 1, '#ff2d2d'];
export const COLUMN_COLOR = ['match', ['get', 'kind'],
  'sold', SOLD_COLOR,
  'cap', ['case', ['==', ['get', 'tone'], 'sold'], '#fff2b8', ['interpolate', ['linear'], ['get', 'weight'], 0, '#b9ccff', .45, '#c9ffe4', .82, '#ffd9b0', 1, '#ffc2c2']],
  HEAT_RAMP];
export const HEAT_FLOOR_OPACITY = .55;
export const HALO_OPACITY = .5;
export const COLUMN_LAYERS = ['opportunity-columns', 'opportunity-columns-fine'];
// Al acercarse, las columnas bajan para no tapar la zona (la altura es en metros).
const byZoom = (property, growth) => ['interpolate', ['linear'], ['zoom'],
  4, ['*', ['get', property], growth], 6.5, ['*', ['get', property], growth * .45], 8, ['*', ['get', property], growth * .2], 10, ['*', ['get', property], growth * .08]];
export const columnHeight = growth => byZoom('top', growth);
export const columnBase = growth => byZoom('base', growth);

// Vista 3D (referencia aprobada): Colombia como losa sobre el relieve de sus vecinos, con brillo de costa,
// calor azul→rojo, leyendas de vidrio, brújula y una entrada de ~1,6 s (una vez por sesión).
const COLOMBIA_BOUNDS = [[-79.2, -4.3], [-66.8, 12.6]];
const RELIEF_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const MAP_VIEW = { center: [-73.2, 2.6], zoom: 4.55, pitch: 55, bearing: -4 };
export const GEO_LABELS = [
  { text: 'Mar Caribe', lngLat: [-76.5, 13.2], kind: 'sea' },
  { text: 'Océano Pacífico', lngLat: [-81.4, 3], kind: 'sea' },
  { text: 'Panamá', lngLat: [-80.2, 8.4] },
  { text: 'Venezuela', lngLat: [-66.2, 7.4] },
  { text: 'Brasil', lngLat: [-64, -2.5] },
  { text: 'Ecuador', lngLat: [-78.4, -1.6] },
  { text: 'Perú', lngLat: [-74.5, -5.6] },
];

const EMPTY = { type: 'FeatureCollection', features: [] };

export function buildAdvisorMapStyle({ activeCodes = [], heat, columns = null, columnPoints = null, relief = true, animate = false }) {
  const sources = {
    neighbors: { type: 'geojson', data: '/data/neighbors.geojson', attribution: 'Países vecinos: Natural Earth' },
    departments: {
      type: 'geojson',
      data: '/data/colombia-departments.geojson',
      attribution: 'Cartografía: DANE MGN 2025 · Simplificación: ytolosa/mapas-colombia (CC BY 4.0)',
    },
    opportunity: { type: 'geojson', data: heat },
    columns: { type: 'geojson', data: columns || EMPTY },
    'column-points': { type: 'geojson', data: columnPoints || EMPTY },
  };
  if (relief) sources.dem = { type: 'raster-dem', tiles: [RELIEF_TILES], encoding: 'terrarium', tileSize: 256, maxzoom: 9, attribution: 'Relieve: AWS Terrain Tiles' };
  const layers = [
    { id: 'background', type: 'background', paint: { 'background-color': '#03101e' } },
    { id: 'land', type: 'fill', source: 'neighbors', paint: { 'fill-color': '#0b1d1c', 'fill-opacity': .9 } },
    relief && { id: 'relief', type: 'hillshade', source: 'dem', paint: {
      'hillshade-shadow-color': '#010810', 'hillshade-highlight-color': '#3d5a4a', 'hillshade-accent-color': '#13261d', 'hillshade-exaggeration': .55,
    } },
    { id: 'coast-glow', type: 'line', source: 'neighbors', paint: { 'line-color': '#1fb6ff', 'line-width': 6, 'line-blur': 6, 'line-opacity': .22 } },
    { id: 'country-glow', type: 'line', source: 'departments', paint: { 'line-color': '#1fb6ff', 'line-width': 10, 'line-blur': 10, 'line-opacity': .2 } },
    // La "losa" son copias desplazadas en pantalla: se ve en 3D y no tapa el calor (una extrusión sí lo taparía).
    { id: 'slab-shadow', type: 'fill', source: 'departments', paint: { 'fill-color': '#000', 'fill-opacity': .55, 'fill-translate': [6, 18], 'fill-translate-anchor': 'viewport' } },
    { id: 'slab-side', type: 'fill', source: 'departments', paint: { 'fill-color': '#0a1626', 'fill-translate': [0, 9], 'fill-translate-anchor': 'viewport' } },
    { id: 'departments-fill', type: 'fill', source: 'departments', paint: {
      'fill-color': focusFillColor(activeCodes, null),
    } },
    { id: 'departments-border', type: 'line', source: 'departments', paint: { 'line-color': '#7fa6c7', 'line-width': .8, 'line-opacity': .55 } },
    { id: 'opportunity-heat', type: 'heatmap', source: 'opportunity', paint: {
      'heatmap-weight': ['get', 'weight'],
      'heatmap-intensity': 2.2,
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 40, 5, 95, 8, 180],
      // El calor queda como brillo en el piso: las columnas son lo que se lee.
      'heatmap-opacity': animate ? 0 : HEAT_FLOOR_OPACITY,
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(20, 80, 255, 0)', .15, 'rgba(20, 80, 255, .55)', .35, '#00c2ff', .55, '#3cff9a', .72, '#ffe14d', .86, '#ff8a1f', 1, '#ff2d2d'],
    } },
    // Halo en el piso bajo cada columna: la ubica de lejos y le da brillo.
    { id: 'column-halo', type: 'circle', source: 'column-points', paint: {
      'circle-color': COLUMN_COLOR,
      'circle-radius': ['interpolate', ['exponential', 1.6], ['zoom'], 4, 9, 6, 22, 8, 46, 10, 90],
      'circle-blur': 1,
      'circle-opacity': animate ? 0 : HALO_OPACITY,
      'circle-pitch-alignment': 'map',
    } },
    ...COLUMN_LAYERS.map(id => {
      const fine = id.endsWith('fine');
      return { id, type: 'fill-extrusion', source: 'columns', filter: ['==', ['get', 'lod'], fine ? 'fine' : 'wide'],
        ...(fine ? { minzoom: 6.5 } : { maxzoom: 6.5 }),
        paint: {
          'fill-extrusion-color': COLUMN_COLOR,
          'fill-extrusion-height': columnHeight(animate ? 0 : 1),
          'fill-extrusion-base': columnBase(animate ? 0 : 1),
          'fill-extrusion-opacity': .95,
          'fill-extrusion-vertical-gradient': true,
        } };
    }),
  ].filter(Boolean);
  return { version: 8, sources, layers };
}

export function getEntrancePlan(reducedMotion) {
  if (reducedMotion) return { from: { ...MAP_VIEW }, flyMs: 0, heatDelayMs: 0, heatMs: 0, columnDelayMs: 0, columnMs: 0, pinDelayMs: 0, pinStaggerMs: 0, swayDelayMs: 0 };
  // Las columnas crecen cuando el vuelo ya casi aterriza; el giro en reposo arranca después.
  return { from: { zoom: MAP_VIEW.zoom - 1.1, pitch: 0, bearing: 0 }, flyMs: 1200, heatDelayMs: 900, heatMs: 600, columnDelayMs: 1000, columnMs: 750, pinDelayMs: 1000, pinStaggerMs: 90, swayDelayMs: 2500 };
}

// Enfoque de zona: la zona elegida se aclara, el resto se atenúa y su calor aparece aparte.
export function focusFillColor(activeCodes, focusedCode) {
  const active = ['in', ['get', 'divipola_dep'], ['literal', activeCodes]];
  if (!focusedCode) return ['case', active, '#21507c', '#0d1724'];
  return ['case', ['==', ['get', 'divipola_dep'], focusedCode], '#2b5d8f', active, '#13263a', '#0e1a29'];
}

// Zonas sin explorar (sin clientes): candado en su capital y un mensaje de videojuego al tocarlas.
export function getLockedPoints(capitals, activeCodes) {
  const active = new Set(activeCodes);
  const seen = new Set();
  return {
    type: 'FeatureCollection',
    features: capitals.filter(capital => !active.has(capital.departmentCode) && !seen.has(capital.departmentCode) && seen.add(capital.departmentCode))
      .map(capital => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [capital.longitude, capital.latitude] }, properties: { code: capital.departmentCode, department: capital.department } })),
  };
}

// Cada cliente trae 4 tareas y cada tarea suma XP (game.js): eso es lo que se gana al desbloquear.
export function lockedZoneMessage(department) {
  return {
    title: `${department} · Zona sin explorar`,
    body: 'Aún no has explorado esta zona. Se desbloquea cuando te asignen un cliente nuevo aquí.',
    reward: `Desbloquéala para ganar más experiencia: hasta +${getXp(4)} XP por cliente.`,
  };
}

// Textura de "terreno sin explorar": niebla con rayado y motas, dibujada en un canvas (sin imágenes externas).
function fogTexture(size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(7, 13, 22, .78)';
  context.fillRect(0, 0, size, size);
  context.strokeStyle = 'rgba(120, 150, 185, .13)';
  context.lineWidth = 2;
  for (let offset = -size; offset < size; offset += 10) {
    context.beginPath();
    context.moveTo(offset, size);
    context.lineTo(offset + size, 0);
    context.stroke();
  }
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let index = 0; index < 26; index++) {
    context.fillStyle = `rgba(170, 195, 225, ${.05 + random() * .12})`;
    context.beginPath();
    context.arc(random() * size, random() * size, .6 + random() * 1.6, 0, Math.PI * 2);
    context.fill();
  }
  return context.getImageData(0, 0, size, size);
}

function lockIcon(size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const middle = size / 2;
  context.fillStyle = 'rgba(4, 16, 30, .88)';
  context.strokeStyle = '#6f8aa6';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(middle, middle, middle - 3, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.strokeStyle = '#c9dcef';
  context.lineWidth = 4;
  context.beginPath();
  context.arc(middle, middle - 4, 8, Math.PI, 0);
  context.stroke();
  context.fillStyle = '#c9dcef';
  context.fillRect(middle - 12, middle - 4, 24, 18);
  context.fillStyle = '#04101e';
  context.fillRect(middle - 2, middle + 1, 4, 8);
  return context.getImageData(0, 0, size, size);
}

// Nubes ligeras que pasan despacio sobre el mapa; no reciben clics.
export function createMapClouds() {
  const clouds = document.createElement('div');
  clouds.className = 'map-clouds';
  clouds.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 4; index++) clouds.append(document.createElement('span'));
  return clouds;
}

// Al enfocar una zona, sus columnas conservan el color y las demás se apagan.
export function focusColumnColor(department) {
  return department ? ['case', ['==', ['get', 'department'], department], COLUMN_COLOR, '#2a3b52'] : COLUMN_COLOR;
}

export function zoneHeatFilter(department) {
  return ['==', ['get', 'department'], department];
}

export function getFocusPlan(reducedMotion) {
  return reducedMotion ? { flyMs: 0, heatMs: 0, dimHeatOpacity: .25 } : { flyMs: 900, heatMs: 600, dimHeatOpacity: .25 };
}

export function getFeatureBounds(feature) {
  const { type, coordinates } = feature.geometry;
  const rings = type === 'MultiPolygon' ? coordinates.flat() : coordinates;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return [[minX, minY], [maxX, maxY]];
}

// Anima una propiedad de pintura con requestAnimationFrame; con 0 ms la pone directo.
// `build` arma el valor final (por ejemplo, una expresión) a partir del número animado.
function tweenPaint(layer, property, from, to, ms, delay = 0, build = value => value) {
  if (!ms) { map?.setPaintProperty(layer, property, build(to)); return; }
  const start = performance.now() + delay;
  const step = now => {
    if (!map?.getLayer(layer)) return;
    const progress = Math.min(1, Math.max(0, (now - start) / ms));
    const eased = 1 - (1 - progress) ** 3;
    map.setPaintProperty(layer, property, build(from + (to - from) * eased));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function getCityProgress(clients, sales) {
  const all = clients.flatMap(client => client.tasks || []);
  const done = all.filter(task => task.completed).length;
  const sold = new Set(sales.filter(sale => sale.confirmed).map(sale => sale.client_id));
  return { percent: all.length ? Math.round(done / all.length * 100) : 0, sold: clients.length > 0 && clients.every(client => sold.has(client.id)) };
}

// MapLibre ubica el marcador con el transform de la raíz: las animaciones van en el botón de adentro.
export function createCityPin(count, label, progress = null) {
  const root = document.createElement('div');
  root.className = 'advisor-city-pin-root';
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'advisor-city-marker';
  pin.textContent = String(count);
  pin.setAttribute('aria-label', label);
  if (progress) {
    pin.style.setProperty('--pin-progress', `${progress.percent}%`);
    pin.dataset.state = progress.sold ? 'sold' : 'progress';
    pin.setAttribute('aria-label', `${label} · ${progress.sold ? 'venta confirmada' : `${progress.percent} % de tareas`}`);
    if (progress.target) pin.classList.add('is-target');
  }
  root.append(pin);
  return { root, pin };
}

const COMPASS_SVG = '<svg viewBox="-50 -50 100 100"><circle r="44" fill="none" stroke="#2c5677"/><path d="M0-40 8-8 40 0 8 8 0 40-8 8-40 0-8-8Z" fill="#c9dcef"/><path d="M0-40 8-8 0 0-8-8Z" fill="#fff"/><text y="-28" text-anchor="middle" fill="#dfeaf5" font-size="11">N</text><text y="37" text-anchor="middle" fill="#dfeaf5" font-size="11">S</text><text x="34" y="4" text-anchor="middle" fill="#dfeaf5" font-size="11">E</text><text x="-34" y="4" text-anchor="middle" fill="#dfeaf5" font-size="11">O</text></svg>';

export function createMapOverlays() {
  const heatLegend = document.createElement('div');
  heatLegend.className = 'map-glass map-heat-legend';
  heatLegend.innerHTML = '<strong>Toneladas por vender</strong><div class="map-heat-ramp"></div><div class="map-heat-labels"><span>Baja</span><span>Alta</span></div><span class="map-sold-key">Base dorada: vendidas</span>';
  const compass = document.createElement('div');
  compass.className = 'map-glass map-compass';
  compass.setAttribute('aria-hidden', 'true');
  compass.innerHTML = COMPASS_SVG;
  const stateLegend = document.createElement('div');
  stateLegend.className = 'map-glass map-state-legend';
  stateLegend.innerHTML = '<span class="map-state-locked">Bloqueado</span><span class="map-state-active">Con clientes</span>';
  return { heatLegend, compass, stateLegend };
}

function cityLabel(group) {
  return `${group.city}, ${group.department}: ${group.clients.length} ${group.clients.length === 1 ? 'cliente' : 'clientes'}`;
}

export async function renderAdvisorClientMap(container, clients = [], onStatus = () => {}, sales = [], { zones = [] } = {}) {
  destroyAdvisorClientMap();
  const current = generation;
  const [{ Map: MapLibreMap, Popup, Marker, setWorkerUrl }, , response, { default: workerUrl }, departmentsResponse] = await Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl.css'),
    fetch('/data/colombia-capitals.json'),
    import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
    fetch('/data/colombia-departments.geojson'),
  ]);
  if (!response.ok) throw new Error('No se pudo cargar el catálogo local de ciudades.');
  const capitals = await response.json();
  // Geometría completa de cada departamento para encuadrar la zona al enfocarla.
  const departments = departmentsResponse.ok ? await departmentsResponse.json() : { features: [] };
  const states = getDepartmentClientStates(clients, capitals);
  const { groups, warnings } = groupCityClients(clients, capitals);
  if (current !== generation || !container.isConnected) return;
  const activeCodes = [...states].filter(([, state]) => state.clients.length).map(([code]) => code);
  const target = getTodayTarget(zones, capitals);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // La entrada corre cada vez que se abre el mapa (con "reducir movimiento", directo).
  const animate = !reduced;
  const plan = getEntrancePlan(!animate);
  container.classList.add('advisor-map-container');
  // Las columnas se ajustan al tamaño de su departamento.
  const departmentRadius = new Map(departments.features.map(feature => [feature.properties?.divipola_dep, getDepartmentRadiusKm(feature)]));
  const codeByDepartment = new Map(capitals.map(capital => [capital.department, capital.departmentCode]));
  const radiusFor = city => departmentRadius.get(codeByDepartment.get(city.department)) || 40;
  const cityTonnage = getCityTonnage(clients, sales, capitals);
  const confirmedSales = new Map(sales.filter(sale => sale.confirmed).map(sale => [sale.client_id, sale]));

  setWorkerUrl(workerUrl);
  map = new MapLibreMap({
    container,
    // El relieve viene de internet y se agrega después de cargar: lo local aparece de inmediato.
    style: buildAdvisorMapStyle({
      activeCodes, heat: getOpportunityHeat(clients, sales, capitals),
      columns: getOpportunityColumns(cityTonnage, { radiusFor }), columnPoints: getColumnPoints(cityTonnage), relief: false, animate,
    }),
    bounds: COLOMBIA_BOUNDS,
    fitBoundsOptions: { padding: 24 },
    maxPitch: 60,
    attributionControl: { compact: true },
  });
  // La vista final se encuadra según el ancho del panel (responsive) y se inclina como la referencia.
  let userMoved = false;
  const finalView = () => {
    const narrow = container.clientWidth < 600;
    const camera = map.cameraForBounds(COLOMBIA_BOUNDS, { padding: narrow ? 16 : 40 }) || { center: MAP_VIEW.center, zoom: MAP_VIEW.zoom };
    const center = Array.isArray(camera.center) ? camera.center : [camera.center.lng, camera.center.lat];
    return { center: [center[0] + (narrow ? .2 : .4), center[1] - (narrow ? 1.2 : .7)], zoom: camera.zoom + (narrow ? -.15 : .35), pitch: MAP_VIEW.pitch, bearing: MAP_VIEW.bearing };
  };
  // Giro en reposo: la cámara se mece ±8° muy despacio hasta que el asesor toca el mapa.
  let swayTimer = null, swayStopped = reduced, swayDirection = 1;
  function startSway() {
    if (swayStopped || !map || current !== generation) return;
    map.easeTo({ bearing: MAP_VIEW.bearing + 8 * swayDirection, duration: 12000, easing: t => (1 - Math.cos(Math.PI * t)) / 2 });
    swayDirection *= -1;
    map.once('moveend', () => { if (!swayStopped) startSway(); });
  }
  function stopSway() {
    if (swayStopped) return;
    swayStopped = true;
    clearTimeout(swayTimer);
    map?.stop();
  }
  for (const type of ['mousedown', 'touchstart', 'wheel', 'dragstart']) map.on(type, stopSway);
  map.on('dragstart', () => { userMoved = true; });
  map.on('resize', () => { if (!userMoved && map) map.jumpTo(finalView()); });
  let ready = false;
  map.once('load', () => {
    ready = true;
    onStatus('ready');
    // Créditos plegados en el botón ⓘ para que no tapen las leyendas.
    container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    const withRelief = buildAdvisorMapStyle({ activeCodes, heat: { type: 'FeatureCollection', features: [] }, relief: true });
    map.addSource('dem', withRelief.sources.dem);
    map.addLayer(withRelief.layers.find(layer => layer.id === 'relief'), 'coast-glow');
    // Cielo y niebla al fondo: dan profundidad a la vista inclinada. Si la versión no los trae, se omiten.
    try {
      map.setSky({ 'sky-color': '#0a2440', 'horizon-color': '#1b4f7a', 'fog-color': '#03101e', 'sky-horizon-blend': .6, 'horizon-fog-blend': .7, 'fog-ground-blend': .35, 'atmosphere-blend': 0 });
    } catch { /* sin cielo */ }
    // Zonas sin explorar: niebla rayada encima del departamento y un candado en su capital.
    map.addImage('fog-texture', fogTexture(), { pixelRatio: 2 });
    map.addImage('lock-icon', lockIcon(), { pixelRatio: 2 });
    map.addLayer({ id: 'locked-fog', type: 'fill', source: 'departments', filter: ['!', ['in', ['get', 'divipola_dep'], ['literal', activeCodes]]],
      paint: { 'fill-pattern': 'fog-texture', 'fill-opacity': .9 } }, 'departments-border');
    map.addLayer({ id: 'locked-flash', type: 'line', source: 'departments', filter: ['==', ['get', 'divipola_dep'], ''],
      paint: { 'line-color': '#ff7598', 'line-width': 3, 'line-blur': 1, 'line-opacity': 0 } }, 'opportunity-heat');
    map.addSource('locked-points', { type: 'geojson', data: getLockedPoints(capitals, activeCodes) });
    map.addLayer({ id: 'locked-icons', type: 'symbol', source: 'locked-points', layout: {
      'icon-image': 'lock-icon', 'icon-size': ['interpolate', ['linear'], ['zoom'], 4, .55, 7, .85], 'icon-allow-overlap': true,
    }, paint: { 'icon-opacity': .85 } });
    if (!animate) { map.jumpTo(finalView()); return; }
    const view = finalView();
    map.jumpTo({ center: view.center, ...plan.from });
    map.flyTo({ ...view, duration: plan.flyMs, essential: true });
    tweenPaint('opportunity-heat', 'heatmap-opacity', 0, HEAT_FLOOR_OPACITY, plan.heatMs, plan.heatDelayMs);
    for (const layer of COLUMN_LAYERS) {
      tweenPaint(layer, 'fill-extrusion-height', 0, 1, plan.columnMs, plan.columnDelayMs, columnHeight);
      tweenPaint(layer, 'fill-extrusion-base', 0, 1, plan.columnMs, plan.columnDelayMs, columnBase);
    }
    tweenPaint('column-halo', 'circle-opacity', 0, HALO_OPACITY, plan.columnMs, plan.columnDelayMs);
    swayTimer = setTimeout(startSway, plan.swayDelayMs);
    pins.forEach((pin, index) => pin.animate(
      [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: 380, delay: plan.pinDelayMs + index * plan.pinStaggerMs, easing: 'cubic-bezier(.34, 1.56, .64, 1)', fill: 'backwards' },
    ));
  });
  // El relieve viene de internet: si falla, el mapa sigue sin relieve y sin mostrar error.
  map.on('error', event => {
    if (event.sourceId === 'dem') return;
    onStatus('error', `No se pudo cargar el mapa: ${event.error?.message || 'error desconocido'}`);
  });

  hoverPopup = new Popup({ closeButton: false, closeOnClick: false });
  // Las columnas quedan encima de los departamentos: si el puntero está sobre una, manda la columna.
  const onColumn = point => map.queryRenderedFeatures(point, { layers: COLUMN_LAYERS.filter(layer => map.getLayer(layer)) })[0];
  map.on('mousemove', COLUMN_LAYERS, event => {
    if (detailPopup?.isOpen()) return;
    const column = event.features?.[0]?.properties;
    if (!column) return;
    map.getCanvas().style.cursor = 'pointer';
    const city = cityTonnage.find(item => item.city === column.city && item.department === column.department);
    const tons = value => `${Math.round(value).toLocaleString('es-CO')} t`;
    const parts = [city?.soldTons && `${tons(city.soldTons)} vendidas`, city?.pendingTons && `${tons(city.pendingTons)} por vender`].filter(Boolean);
    hoverPopup.setLngLat(event.lngLat).setText(`${column.city} · ${parts.join(' · ')}`).addTo(map);
  });
  map.on('mouseleave', COLUMN_LAYERS, () => {
    map.getCanvas().style.cursor = '';
    hoverPopup.remove();
  });
  map.on('click', COLUMN_LAYERS, event => {
    const column = event.features?.[0]?.properties;
    const group = groups.find(item => item.city === column?.city && item.department === column?.department);
    if (group) showCityDetail(group);
  });
  map.on('mousemove', 'departments-fill', event => {
    if (onColumn(event.point)) return;
    if (detailPopup?.isOpen()) {
      map.getCanvas().style.cursor = '';
      hoverPopup.remove();
      return;
    }
    const code = event.features?.[0]?.properties?.divipola_dep;
    const state = states.get(code);
    if (!state) return;
    map.getCanvas().style.cursor = 'pointer';
    const message = state.clients.length
      ? `${state.name} · ${state.clients.length} ${state.clients.length === 1 ? 'cliente' : 'clientes'}`
      : `Bloqueado · ${state.name} sin explorar`;
    hoverPopup.setLngLat(event.lngLat).setText(message).addTo(map);
  });
  map.on('mouseleave', 'departments-fill', () => {
    map.getCanvas().style.cursor = '';
    hoverPopup.remove();
  });
  map.on('click', 'departments-fill', event => {
    if (onColumn(event.point)) return;
    const code = event.features?.[0]?.properties?.divipola_dep;
    const state = states.get(code);
    if (!state) return;
    // Un departamento con clientes y cifras de zona se enfoca; los demás muestran su detalle.
    const zone = zones.find(item => item.code === code);
    if (zone && state.clients.length) { focusZone(zone); return; }
    hoverPopup.remove();
    detailPopup?.remove();
    const content = document.createElement('div');
    if (!state.clients.length) {
      // Zona bloqueada: el borde parpadea y un aviso de videojuego explica cómo desbloquearla.
      const message = lockedZoneMessage(state.name);
      content.className = 'map-locked-popup';
      const title = document.createElement('strong');
      title.textContent = message.title;
      const body = document.createElement('p');
      body.textContent = message.body;
      const reward = document.createElement('p');
      reward.className = 'map-locked-reward';
      reward.textContent = message.reward;
      content.append(title, body, reward);
      if (map.getLayer('locked-flash')) {
        map.setFilter('locked-flash', ['==', ['get', 'divipola_dep'], code]);
        tweenPaint('locked-flash', 'line-opacity', 1, 0, reduced ? 0 : 900);
      }
    } else {
      const title = document.createElement('strong');
      title.textContent = state.name;
      const list = document.createElement('ul');
      const cities = new Map();
      for (const client of state.clients) {
        const city = client.city || 'Sin ciudad';
        if (!cities.has(city)) cities.set(city, []);
        cities.get(city).push(`${client.name} · ${client.type}`);
      }
      for (const [city, names] of cities) {
        const item = document.createElement('li');
        item.textContent = `${city}: ${names.join(', ')}`;
        list.append(item);
      }
      content.append(title, list);
    }
    detailPopup = new Popup().setLngLat(event.lngLat).setDOMContent(content).addTo(map);
  });

  for (const label of GEO_LABELS) {
    const node = document.createElement('div');
    node.className = `map-geo-label${label.kind ? ` map-geo-label-${label.kind}` : ''}`;
    node.setAttribute('aria-hidden', 'true');
    node.textContent = label.text;
    markers.push(new Marker({ element: node }).setLngLat(label.lngLat).addTo(map));
  }
  function showCityDetail(group) {
    hoverPopup.remove();
    detailPopup?.remove();
    const content = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `${group.city}, ${group.department}`;
    const list = document.createElement('ul');
    for (const client of group.clients) {
      const item = document.createElement('li');
      const sale = confirmedSales.get(client.id);
      const tons = Number(sale?.tons_sold || client.tons_requested || 0);
      item.textContent = `${client.name} · ${client.type} · ${tons.toLocaleString('es-CO')} t ${sale ? 'vendidas' : 'por vender'}`;
      list.append(item);
    }
    content.append(title, list);
    detailPopup = new Popup().setLngLat(group.coordinates).setDOMContent(content).addTo(map);
  }
  const pins = [];
  for (const group of groups) {
    const progress = { ...getCityProgress(group.clients, sales), target: target?.department === group.department };
    const { root, pin } = createCityPin(group.clients.length, cityLabel(group), progress);
    pin.addEventListener('click', event => {
      event.stopPropagation();
      showCityDetail(group);
    });
    pins.push(pin);
    // El pin cuelga un poco por debajo de la base para no tapar la columna.
    markers.push(new Marker({ element: root, offset: [0, 18] }).setLngLat(group.coordinates).addTo(map));
  }

  const { heatLegend, compass, stateLegend } = createMapOverlays();
  overlays = [createMapClouds(), heatLegend, compass, stateLegend];
  const targetCard = target && createTargetCard(target, () => {
    userMoved = true;
    stopSway();
    map?.flyTo({ center: target.coordinates, zoom: finalView().zoom + 1.4, pitch: 50, bearing: MAP_VIEW.bearing, duration: reduced ? 0 : 900, essential: true });
  });
  if (targetCard) overlays.push(targetCard);
  container.append(...overlays);

  // Enfocar una zona: vuelo al departamento, resto atenuado, borde brillante y su calor de 0 al valor.
  let zoneCard = null;
  const heatPaint = buildAdvisorMapStyle({ activeCodes, heat: null }).layers.find(layer => layer.id === 'opportunity-heat').paint;
  function focusZone(zone) {
    const feature = departments.features.find(item => item.properties?.divipola_dep === zone.code);
    if (!map || !feature) return;
    // Si el mapa todavía carga, el enfoque espera a que esté listo.
    if (!ready) { map.once('load', () => focusZone(zone)); return; }
    const focusPlan = getFocusPlan(reduced);
    userMoved = true;
    stopSway();
    hoverPopup.remove();
    detailPopup?.remove();
    if (!map.getLayer('zone-outline')) {
      map.addLayer({ id: 'zone-outline', type: 'line', source: 'departments', paint: { 'line-color': '#ffd76a', 'line-width': 3, 'line-blur': 1.5 } }, 'opportunity-heat');
      map.addLayer({ id: 'zone-heat', type: 'heatmap', source: 'opportunity', paint: { ...heatPaint, 'heatmap-opacity': 0 } }, 'column-halo');
    }
    map.setFilter('zone-outline', ['==', ['get', 'divipola_dep'], zone.code]);
    map.setFilter('zone-heat', zoneHeatFilter(zone.department));
    map.setPaintProperty('departments-fill', 'fill-color', focusFillColor(activeCodes, zone.code));
    for (const layer of COLUMN_LAYERS) map.setPaintProperty(layer, 'fill-extrusion-color', focusColumnColor(zone.department));
    map.setPaintProperty('column-halo', 'circle-color', focusColumnColor(zone.department));
    map.setPaintProperty('opportunity-heat', 'heatmap-opacity', focusPlan.dimHeatOpacity);
    map.setPaintProperty('zone-heat', 'heatmap-opacity', 0);
    tweenPaint('zone-heat', 'heatmap-opacity', 0, .95, focusPlan.heatMs, focusPlan.flyMs * .5);
    map.fitBounds(getFeatureBounds(feature), { padding: container.clientWidth < 600 ? 48 : 110, pitch: 50, bearing: MAP_VIEW.bearing, maxZoom: 8, duration: focusPlan.flyMs, essential: true });
    zoneCard?.remove();
    zoneCard = createZoneFocusCard(zone, resetFocus);
    targetCard?.setAttribute('hidden', '');
    container.append(zoneCard);
    overlays.push(zoneCard);
  }
  function resetFocus() {
    if (!map) return;
    const focusPlan = getFocusPlan(reduced);
    zoneCard?.remove();
    zoneCard = null;
    targetCard?.removeAttribute('hidden');
    map.setPaintProperty('departments-fill', 'fill-color', focusFillColor(activeCodes, null));
    for (const layer of COLUMN_LAYERS) map.setPaintProperty(layer, 'fill-extrusion-color', focusColumnColor(null));
    map.setPaintProperty('column-halo', 'circle-color', focusColumnColor(null));
    if (map.getLayer('zone-outline')) {
      map.setFilter('zone-outline', ['==', ['get', 'divipola_dep'], '']);
      map.setPaintProperty('zone-heat', 'heatmap-opacity', 0);
    }
    tweenPaint('opportunity-heat', 'heatmap-opacity', focusPlan.dimHeatOpacity, HEAT_FLOOR_OPACITY, focusPlan.heatMs);
    userMoved = false;
    map.flyTo({ ...finalView(), duration: focusPlan.flyMs, essential: true });
  }
  const needle = compass.querySelector('svg');
  map.on('rotate', () => { needle.style.transform = `rotate(${-map.getBearing()}deg)`; });

  if (warnings.length) {
    warningNode = document.createElement('p');
    warningNode.className = 'advisor-map-warning';
    warningNode.setAttribute('role', 'status');
    warningNode.textContent = `${warnings.length} ${warnings.length === 1 ? 'cliente no se pudo ubicar' : 'clientes no se pudieron ubicar'} en una ciudad del mapa.`;
    container.append(warningNode);
  }
  return { focusZone, resetFocus };
}

export function destroyAdvisorClientMap() {
  generation += 1;
  hoverPopup?.remove();
  detailPopup?.remove();
  for (const marker of markers) marker.remove();
  markers = [];
  overlays.forEach(node => node.remove());
  overlays = [];
  warningNode?.remove();
  warningNode = undefined;
  hoverPopup = detailPopup = undefined;
  map?.remove();
  map = undefined;
}
