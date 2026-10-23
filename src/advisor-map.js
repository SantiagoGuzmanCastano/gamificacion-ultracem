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
// Radio (km) de la columna de una ciudad en cada nivel de detalle.
export const columnRadiusKm = (departmentRadius, lod) => clamp(departmentRadius * COLUMN_LOD[lod].share, COLUMN_LOD[lod].min, COLUMN_LOD[lod].max);
// Dos niveles de detalle: columnas gruesas para leer el país y finas al acercarse a una zona.
export const COLUMN_LOD = {
  wide: { share: .45, min: 11, max: 28 },
  fine: { share: .16, min: 2.5, max: 11 },
};

// Columnas 3D apiladas por ciudad: base dorada con lo vendido, encima lo que falta en color de calor
// y una tapa clara que brilla. La altura total sigue las toneladas; la mínima deja ver las ciudades pequeñas.
export function getOpportunityColumns(cities, { radiusFor = () => 40, sides = 32, maxHeight = 260000, minShare = .1 } = {}) {
  const maxTotal = Math.max(0, ...(cities || []).map(city => city.soldTons + city.pendingTons));
  const maxPending = Math.max(0, ...(cities || []).map(city => city.pendingTons));
  const features = [];
  for (const city of cities || []) {
    const total = city.soldTons + city.pendingTons;
    const unit = Math.max(total / maxTotal, minShare) * maxHeight / total;
    const soldTop = city.soldTons * unit, top = total * unit;
    const capBase = top * .955;
    const props = { city: city.city, department: city.department, floor: Math.min(soldTop, capBase) };
    const pendingWeight = maxPending ? city.pendingTons / maxPending : 0;
    for (const [lod, sizing] of Object.entries(COLUMN_LOD)) {
      const ring = circle(city.coordinates, columnRadiusKm(radiusFor(city), lod), sides);
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
      properties: { city: city.city, department: city.department, kind: city.pendingTons > 0 ? 'pending' : 'sold', sold: city.soldTons, weight: maxPending ? city.pendingTons / maxPending : 0 },
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
// Al acercarse, las columnas bajan para no tapar la zona (la altura es en metros). Cada parada:
// [zoom, factor de altura de las columnas, cuánto sube el departamento en hover].
const ZOOM_STOPS = [[4, 1, 45000], [6.5, .45, 20000], [8, .2, 11000], [10, .08, 3000]];

// Altura de la base o la punta de cada tramo: lo vendido crece con `sold`, lo que está encima con
// `pending`, y si su departamento está en hover, toda la columna sube con él (`lift`).
export function columnLevel(property, { sold = 1, pending = 1, department = null, lift = 0 } = {}) {
  const value = ['get', property], floor = ['get', 'floor'];
  const core = ['+', ['*', ['min', value, floor], sold], ['*', ['max', ['-', value, floor], 0], pending]];
  return ['interpolate', ['linear'], ['zoom'], ...ZOOM_STOPS.flatMap(([zoom, factor, rise]) => [zoom,
    department && lift ? ['+', ['*', core, factor], ['case', ['==', ['get', 'department'], department], rise * lift, 0]] : ['*', core, factor]])];
}
// Factor de altura y cuánto sube un departamento en hover, para un zoom dado (las mismas paradas de las columnas).
export function zoomStopsAt(zoom) {
  const stops = ZOOM_STOPS;
  if (zoom <= stops[0][0]) return { factor: stops[0][1], rise: stops[0][2] };
  for (let index = 1; index < stops.length; index++) {
    const [z1, f1, r1] = stops[index], [z0, f0, r0] = stops[index - 1];
    if (zoom <= z1) {
      const t = (zoom - z0) / (z1 - z0);
      return { factor: f0 + (f1 - f0) * t, rise: r0 + (r1 - r0) * t };
    }
  }
  const [, factor, rise] = stops.at(-1);
  return { factor, rise };
}
export const hoverLift = growth => ['interpolate', ['linear'], ['zoom'], ...ZOOM_STOPS.flatMap(([zoom, , rise]) => [zoom, rise * growth])];

// Brillo dorado de lo vendido: un resplandor que respira y ondas que salen de la base.
export const SOLD_FILTER = ['>', ['get', 'sold'], 0];
export const soldRingRadius = radius => ['interpolate', ['exponential', 1.6], ['zoom'], 4, radius, 6, radius * 2.4, 8, radius * 5, 10, radius * 10];

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
    // Hover: el departamento bajo el puntero se eleva un poco y se aclara.
    { id: 'department-hover', type: 'fill-extrusion', source: 'departments', filter: ['==', ['get', 'divipola_dep'], ''], paint: {
      'fill-extrusion-color': HOVER_COLORS.active,
      'fill-extrusion-height': hoverLift(0),
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': .92,
      'fill-extrusion-vertical-gradient': true,
    } },
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
    { id: 'sold-glow', type: 'circle', source: 'column-points', filter: SOLD_FILTER, paint: {
      'circle-color': SOLD_COLOR,
      'circle-radius': ['interpolate', ['exponential', 1.6], ['zoom'], 4, 13, 6, 30, 8, 60, 10, 115],
      'circle-blur': 1,
      'circle-opacity': animate ? 0 : .4,
      'circle-pitch-alignment': 'map',
    } },
    { id: 'sold-ring', type: 'circle', source: 'column-points', filter: SOLD_FILTER, paint: {
      'circle-color': 'rgba(0, 0, 0, 0)',
      'circle-radius': soldRingRadius(6),
      'circle-stroke-color': '#ffe27a',
      'circle-stroke-width': 2.5,
      'circle-stroke-opacity': 0,
      'circle-pitch-alignment': 'map',
    } },
    ...COLUMN_LAYERS.map(id => {
      const fine = id.endsWith('fine');
      return { id, type: 'fill-extrusion', source: 'columns', filter: ['==', ['get', 'lod'], fine ? 'fine' : 'wide'],
        ...(fine ? { minzoom: 6.5 } : { maxzoom: 6.5 }),
        paint: {
          'fill-extrusion-color': COLUMN_COLOR,
          'fill-extrusion-height': columnLevel('top', animate ? { sold: 0, pending: 0 } : {}),
          'fill-extrusion-base': columnLevel('base', animate ? { sold: 0, pending: 0 } : {}),
          'fill-extrusion-opacity': .95,
          'fill-extrusion-vertical-gradient': true,
        } };
    }),
  ].filter(Boolean);
  return { version: 8, sources, layers };
}

export function getEntrancePlan(reducedMotion) {
  if (reducedMotion) return { from: { ...MAP_VIEW }, flyMs: 0, heatDelayMs: 0, heatMs: 0, columnDelayMs: 0, columnMs: 0, pendingDelayMs: 0, pendingMs: 0, pinDelayMs: 0, pinStaggerMs: 0, swayDelayMs: 0 };
  // Las columnas crecen cuando el vuelo ya casi aterriza; el giro en reposo arranca después.
  return { from: { zoom: MAP_VIEW.zoom - 1.1, pitch: 0, bearing: 0 }, flyMs: 1200, heatDelayMs: 900, heatMs: 600, columnDelayMs: 1000, columnMs: 750, pendingDelayMs: 1550, pendingMs: 600, pinDelayMs: 1000, pinStaggerMs: 90, swayDelayMs: 2500 };
}

// Enfoque de zona: la zona elegida se aclara, el resto se atenúa y su calor aparece aparte.
export function focusFillColor(activeCodes, focusedCode) {
  const active = ['in', ['get', 'divipola_dep'], ['literal', activeCodes]];
  if (!focusedCode) return ['case', active, '#21507c', '#0d1724'];
  return ['case', ['==', ['get', 'divipola_dep'], focusedCode], '#2b5d8f', active, '#13263a', '#0e1a29'];
}

// Cada cliente trae 4 tareas y cada tarea suma XP (game.js): eso es lo que se gana al desbloquear.
export function lockedZoneMessage(department) {
  return {
    title: `${department} · Zona sin explorar`,
    body: 'Aún no has explorado esta zona. Se desbloquea cuando te asignen un cliente nuevo aquí.',
    reward: `Desbloquéala para ganar más experiencia: hasta +${getXp(4)} XP por cliente.`,
  };
}

// Hover de departamento: cuánto sube (en metros, menos al acercarse) y de qué color según su estado.
export const HOVER_COLORS = { active: '#3478b8', locked: '#3a4a60' };

// Contenido del tooltip: nombre, estado en texto y si está bloqueado (para el candado).
export function getDepartmentHoverTip(name, clientCount) {
  if (!clientCount) return { title: name, detail: 'Sin explorar · toca para ver cómo desbloquearla', locked: true };
  return { title: name, detail: `${clientCount} ${clientCount === 1 ? 'cliente' : 'clientes'} · toca para enfocar`, locked: false };
}

function createHoverTip({ title, detail, locked }) {
  const tip = document.createElement('div');
  tip.className = `map-tip${locked ? ' map-tip-locked' : ''}`;
  const heading = document.createElement('strong');
  heading.textContent = title;
  const line = document.createElement('span');
  line.textContent = detail;
  tip.append(heading, line);
  return tip;
}

// Textura de "terreno sin explorar": niebla con rayado y motas, dibujada en un canvas (sin imágenes externas).
function fogTexture(size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(5, 10, 18, .9)';
  context.fillRect(0, 0, size, size);
  context.strokeStyle = 'rgba(140, 165, 200, .24)';
  context.lineWidth = 2.5;
  for (let offset = -size; offset < size; offset += 8) {
    context.beginPath();
    context.moveTo(offset, size);
    context.lineTo(offset + size, 0);
    context.stroke();
  }
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let index = 0; index < 40; index++) {
    context.fillStyle = `rgba(170, 195, 225, ${.08 + random() * .16})`;
    context.beginPath();
    context.arc(random() * size, random() * size, .6 + random() * 1.6, 0, Math.PI * 2);
    context.fill();
  }
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

export const easeOutCubic = t => 1 - (1 - t) ** 3;
// Sube un poco de más y se asienta: el "pop" de lo vendido.
export const easeOutBack = t => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

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

let heatLegendCollapsed = false;

export function createMapOverlays() {
  const heatLegend = document.createElement('div');
  heatLegend.className = 'map-glass map-heat-legend';
  // El título es un botón que pliega la leyenda para dejar ver el mapa; se recuerda en la sesión.
  heatLegend.innerHTML = '<button type="button" class="map-heat-toggle" aria-expanded="true" aria-controls="map-heat-body"><strong>Toneladas por vender</strong><span class="map-heat-chevron" aria-hidden="true"></span></button><div class="map-heat-body" id="map-heat-body"><div class="map-heat-ramp"></div><div class="map-heat-labels"><span>Baja</span><span>Alta</span></div><span class="map-sold-key">Base dorada: vendidas</span></div>';
  const toggle = heatLegend.querySelector('.map-heat-toggle');
  const setCollapsed = collapsed => {
    heatLegend.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Mostrar leyenda de toneladas' : 'Ocultar leyenda de toneladas');
    heatLegendCollapsed = collapsed;
  };
  setCollapsed(heatLegendCollapsed);
  toggle.addEventListener('click', () => setCollapsed(!heatLegendCollapsed));
  const compass = document.createElement('div');
  compass.className = 'map-glass map-compass';
  compass.setAttribute('aria-hidden', 'true');
  compass.innerHTML = COMPASS_SVG;
  const stateLegend = document.createElement('div');
  stateLegend.className = 'map-glass map-state-legend';
  stateLegend.innerHTML = '<span class="map-state-locked">Bloqueado</span><span class="map-state-active">Con clientes</span>';
  return { heatLegend, compass, stateLegend };
}

// Vista del admin: a quién contactar en cada departamento (public/data/prospects.json), de mayor a menor volumen.
export function topProspects(prospects, department) {
  return prospects.filter(item => item.department === department).sort((a, b) => b.estimatedTons - a.estimatedTons);
}

// Ficha corta: quién es, una línea con qué hacer y dos botones.
export function createProspectCard(department, prospects) {
  const [top] = prospects;
  const card = document.createElement('div');
  card.className = 'map-prospect';
  const add = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    card.append(node);
    return node;
  };
  add('span', 'map-prospect-kicker', `Cliente potencial · ${department}`);
  if (!top) {
    add('p', 'map-prospect-meta', 'Sin datos en esta zona.');
    return card;
  }
  add('strong', 'map-prospect-name', top.name);
  add('p', 'map-prospect-meta', `${top.type} · ${top.city} · ${Math.round(top.estimatedTons).toLocaleString('es-CO')} t`);
  add('p', 'map-prospect-tip', `Llama a ${(top.contact || 'la empresa').toLowerCase()} para agendar una cita y ofrecer Ultracem.`);
  const actions = document.createElement('div');
  actions.className = 'map-prospect-actions';
  if (top.phone) {
    const call = document.createElement('a');
    call.className = 'map-prospect-call';
    call.href = `tel:${top.phone.replace(/\s+/g, '')}`;
    call.textContent = 'Llamar';
    call.title = top.phone;
    call.setAttribute('aria-label', `Llamar a ${top.name}: ${top.phone}`);
    actions.append(call);
  }
  if (top.website) {
    const web = document.createElement('a');
    web.className = 'map-prospect-web';
    web.href = top.website;
    web.target = '_blank';
    web.rel = 'noopener noreferrer';
    web.textContent = 'Web';
    actions.append(web);
  }
  card.append(actions);
  if (top.phone) add('span', 'map-prospect-sample', `${top.phone} · muestra`);
  return card;
}

function cityLabel(group) {
  return `${group.city}, ${group.department}: ${group.clients.length} ${group.clients.length === 1 ? 'cliente' : 'clientes'}`;
}

// `unlocked` (vista del admin): todo el país activo, sin niebla ni avisos de desbloqueo; `advisorName` pone el asesor de cada cliente.
export async function renderAdvisorClientMap(container, clients = [], onStatus = () => {}, sales = [], { zones = [], unlocked = false, advisorName = null, prospects = [] } = {}) {
  destroyAdvisorClientMap();
  const current = generation;
  const [{ Map: MapLibreMap, Popup, Marker, MercatorCoordinate, setWorkerUrl }, , response, { default: workerUrl }, departmentsResponse] = await Promise.all([
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
  const activeCodes = [...states].filter(([, state]) => unlocked || state.clients.length).map(([code]) => code);
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
  // Estado de las columnas: cuánto creció lo vendido y lo pendiente, y qué departamento está elevado.
  const columnState = { sold: animate ? 0 : 1, pending: animate ? 0 : 1, department: null, lift: 0 };
  const applyColumns = () => {
    for (const layer of COLUMN_LAYERS) {
      if (!map?.getLayer(layer)) continue;
      map.setPaintProperty(layer, 'fill-extrusion-height', columnLevel('top', columnState));
      map.setPaintProperty(layer, 'fill-extrusion-base', columnLevel('base', columnState));
    }
  };
  // Anima un número de 0 a 1 por cuadro; se detiene si el mapa se cerró o se volvió a abrir.
  const animateValue = (ms, delay, ease, onFrame, onDone) => {
    if (!ms) { onFrame(1); onDone?.(); return; }
    const start = performance.now() + delay;
    const step = now => {
      if (!map || current !== generation) return;
      const progress = Math.min(1, Math.max(0, (now - start) / ms));
      onFrame(ease(progress));
      if (progress < 1) requestAnimationFrame(step); else onDone?.();
    };
    requestAnimationFrame(step);
  };
  // Lo vendido: una onda dorada al terminar de crecer y luego un brillo que respira con ondas suaves.
  function startGoldEffects() {
    if (reduced || !map?.getLayer('sold-ring')) return;
    const started = performance.now();
    let last = 0;
    const loop = now => {
      if (!map || current !== generation || !map.getLayer('sold-ring')) return;
      if (now - last > 33) {
        last = now;
        const elapsed = now - started;
        const breath = .5 + .5 * Math.sin(elapsed / 2600 * Math.PI * 2);
        map.setPaintProperty('sold-glow', 'circle-opacity', .28 + .3 * breath);
        // La primera onda es rápida y grande; después, una cada 3,6 s.
        const period = elapsed < 900 ? 900 : 3600;
        const phase = elapsed < 900 ? elapsed / 900 : ((elapsed - 900) % period) / period;
        const wave = easeOutCubic(Math.min(1, phase / .7));
        map.setPaintProperty('sold-ring', 'circle-radius', soldRingRadius(5 + (elapsed < 900 ? 30 : 20) * wave));
        map.setPaintProperty('sold-ring', 'circle-stroke-opacity', phase < .7 ? .9 * (1 - wave) : 0);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // Bultos de cemento 3D (three.js) encima de cada ciudad. Las columnas siguen ahí, invisibles,
  // para el hover y el clic; si three.js no carga, se quedan visibles como antes.
  let focusedDepartment = null;
  async function addCementSacks() {
    try {
      const { createCementSackLayer } = await import('./cement-sacks.js');
      if (!map || current !== generation) return;
      const features = getOpportunityColumns(cityTonnage, { radiusFor }).features;
      const stacks = cityTonnage.map(city => {
        const own = features.filter(feature => feature.properties.city === city.city && feature.properties.department === city.department);
        return {
          ...city,
          floor: own[0]?.properties.floor || 0,
          top: Math.max(0, ...own.map(feature => feature.properties.top)),
          radius: zoom => columnRadiusKm(radiusFor(city), zoom < 6.5 ? 'wide' : 'fine'),
        };
      });
      const getView = zoom => ({ zoom, ...zoomStopsAt(zoom), ...columnState, focus: focusedDepartment });
      map.addLayer(createCementSackLayer({ MercatorCoordinate, stacks, getView }));
      for (const layer of COLUMN_LAYERS) map.setPaintProperty(layer, 'fill-extrusion-opacity', 0);
    } catch (error) {
      console.warn('No se pudieron dibujar los bultos 3D; se quedan las columnas.', error);
    }
  }

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
    // Zonas sin explorar: niebla rayada densa y borde punteado, como terreno sin descubrir.
    const locked = ['!', ['in', ['get', 'divipola_dep'], ['literal', activeCodes]]];
    map.addImage('fog-texture', fogTexture(), { pixelRatio: 2 });
    map.addLayer({ id: 'locked-fog', type: 'fill', source: 'departments', filter: locked,
      paint: { 'fill-pattern': 'fog-texture', 'fill-opacity': 1 } }, 'departments-border');
    map.addLayer({ id: 'locked-border', type: 'line', source: 'departments', filter: locked,
      paint: { 'line-color': '#6d819a', 'line-width': 1.2, 'line-dasharray': [2, 2], 'line-opacity': .7 } }, 'departments-border');
    map.addLayer({ id: 'locked-flash', type: 'line', source: 'departments', filter: ['==', ['get', 'divipola_dep'], ''],
      paint: { 'line-color': '#ff7598', 'line-width': 3, 'line-blur': 1, 'line-opacity': 0 } }, 'opportunity-heat');
    addCementSacks();
    if (!animate) { map.jumpTo(finalView()); return; }
    animateValue(plan.columnMs, plan.columnDelayMs, easeOutBack, value => { columnState.sold = value; applyColumns(); }, startGoldEffects);
    animateValue(plan.pendingMs, plan.pendingDelayMs, easeOutCubic, value => { columnState.pending = value; applyColumns(); });
    const view = finalView();
    map.jumpTo({ center: view.center, ...plan.from });
    map.flyTo({ ...view, duration: plan.flyMs, essential: true });
    tweenPaint('opportunity-heat', 'heatmap-opacity', 0, HEAT_FLOOR_OPACITY, plan.heatMs, plan.heatDelayMs);
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

  hoverPopup = new Popup({ closeButton: false, closeOnClick: false, className: 'map-hover-popup', offset: 14 });
  // Departamento elevado: cambia al mover el puntero y sube con una animación corta.
  let hoveredCode = null, hoverToken = 0;
  function liftDepartment(code, locked) {
    if (code === hoveredCode || !map.getLayer('department-hover')) return;
    hoveredCode = code;
    const token = ++hoverToken;
    map.setFilter('department-hover', ['==', ['get', 'divipola_dep'], code || '']);
    columnState.department = code ? states.get(code)?.name || null : null;
    columnState.lift = 0;
    applyColumns();
    if (!code) return;
    map.setPaintProperty('department-hover', 'fill-extrusion-color', locked ? HOVER_COLORS.locked : HOVER_COLORS.active);
    // El departamento y sus columnas suben juntos, para que lo vendido no quede escondido.
    animateValue(reduced ? 0 : 220, 0, easeOutCubic, value => {
      if (token !== hoverToken) return;
      columnState.lift = value;
      map.setPaintProperty('department-hover', 'fill-extrusion-height', hoverLift(value));
      applyColumns();
    });
  }
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
    hoverPopup.setLngLat(event.lngLat).setDOMContent(createHoverTip({ title: column.city, detail: parts.join(' · '), locked: false })).addTo(map);
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
    const code = event.features?.[0]?.properties?.divipola_dep;
    const state = states.get(code);
    if (!state) return;
    liftDepartment(code, !unlocked && !state.clients.length);
    if (detailPopup?.isOpen()) {
      map.getCanvas().style.cursor = '';
      hoverPopup.remove();
      return;
    }
    map.getCanvas().style.cursor = 'pointer';
    const tip = unlocked && !state.clients.length ? { title: state.name, detail: 'Sin clientes todavía', locked: false } : getDepartmentHoverTip(state.name, state.clients.length);
    hoverPopup.setLngLat(event.lngLat).setDOMContent(createHoverTip(tip)).addTo(map);
  });
  map.on('mouseleave', 'departments-fill', () => {
    map.getCanvas().style.cursor = '';
    hoverPopup.remove();
    liftDepartment(null);
  });
  map.on('click', 'departments-fill', event => {
    if (onColumn(event.point)) return;
    const code = event.features?.[0]?.properties?.divipola_dep;
    const state = states.get(code);
    if (!state) return;
    // Un departamento con clientes y cifras de zona se enfoca; los demás muestran su detalle.
    if (unlocked && prospects.length) { showProspects(state.name, event.lngLat); return; }
    const zone = zones.find(item => item.code === code);
    if (zone && state.clients.length) { focusZone(zone); return; }
    hoverPopup.remove();
    detailPopup?.remove();
    const content = document.createElement('div');
    if (unlocked && !state.clients.length) {
      const title = document.createElement('strong');
      title.textContent = state.name;
      const body = document.createElement('p');
      body.textContent = 'Ningún asesor tiene clientes aquí todavía.';
      content.append(title, body);
    } else if (!state.clients.length) {
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
        cities.get(city).push([client.name, client.type, advisorName?.(client.advisor_id)].filter(Boolean).join(' · '));
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
  function showProspects(department, lngLat) {
    hoverPopup.remove();
    detailPopup?.remove();
    detailPopup = new Popup({ maxWidth: '240px' }).setLngLat(lngLat).setDOMContent(createProspectCard(department, topProspects(prospects, department))).addTo(map);
  }
  // Una estrella por departamento, un poco al sur de la capital para no tapar los pines de clientes.
  if (unlocked) {
    for (const capital of capitals) {
      const [top] = topProspects(prospects, capital.department);
      if (!top) continue;
      const star = document.createElement('button');
      star.type = 'button';
      star.className = 'map-prospect-pin';
      star.setAttribute('aria-label', `Cliente potencial en ${capital.department}: ${top.name}`);
      star.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';
      const at = [capital.longitude, capital.latitude - .35];
      star.addEventListener('click', event => { event.stopPropagation(); showProspects(capital.department, at); });
      markers.push(new Marker({ element: star }).setLngLat(at).addTo(map));
    }
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
      const owner = advisorName?.(client.advisor_id);
      item.textContent = `${client.name} · ${client.type} · ${tons.toLocaleString('es-CO')} t ${sale ? 'vendidas' : 'por vender'}${owner ? ` · ${owner}` : ''}`;
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
  // En la vista del admin sobran las leyendas de calor y de zonas bloqueadas.
  overlays = [createMapClouds(), compass, ...(unlocked ? [] : [heatLegend, stateLegend])];
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
    focusedDepartment = zone.department;
    map.triggerRepaint();
    map.setPaintProperty('column-halo', 'circle-color', focusColumnColor(zone.department));
    for (const layer of ['sold-glow', 'sold-ring']) map.setFilter(layer, ['all', SOLD_FILTER, ['==', ['get', 'department'], zone.department]]);
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
    focusedDepartment = null;
    map.triggerRepaint();
    map.setPaintProperty('column-halo', 'circle-color', focusColumnColor(null));
    for (const layer of ['sold-glow', 'sold-ring']) map.setFilter(layer, SOLD_FILTER);
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
