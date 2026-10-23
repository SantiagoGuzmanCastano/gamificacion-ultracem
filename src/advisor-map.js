import { createTargetCard, getTodayTarget } from './zone-opportunity.js';

export { createTargetCard, createZoneList, getTodayTarget, getZoneOpportunities } from './zone-opportunity.js';

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

// Vista 3D (referencia aprobada): Colombia como losa sobre el relieve de sus vecinos, con brillo de costa,
// calor azul→rojo, leyendas de vidrio, brújula y una entrada de ~1,6 s (una vez por sesión).
const COLOMBIA_BOUNDS = [[-79.2, -4.3], [-66.8, 12.6]];
const ENTRANCE_KEY = 'ultracem-map-entrance';
const RELIEF_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const MAP_VIEW = { center: [-73.2, 2.6], zoom: 4.55, pitch: 45, bearing: -4 };
export const GEO_LABELS = [
  { text: 'Mar Caribe', lngLat: [-76.5, 13.2], kind: 'sea' },
  { text: 'Océano Pacífico', lngLat: [-81.4, 3], kind: 'sea' },
  { text: 'Panamá', lngLat: [-80.2, 8.4] },
  { text: 'Venezuela', lngLat: [-66.2, 7.4] },
  { text: 'Brasil', lngLat: [-64, -2.5] },
  { text: 'Ecuador', lngLat: [-78.4, -1.6] },
  { text: 'Perú', lngLat: [-74.5, -5.6] },
];

export function buildAdvisorMapStyle({ activeCodes = [], heat, relief = true, animate = false }) {
  const sources = {
    neighbors: { type: 'geojson', data: '/data/neighbors.geojson', attribution: 'Países vecinos: Natural Earth' },
    departments: {
      type: 'geojson',
      data: '/data/colombia-departments.geojson',
      attribution: 'Cartografía: DANE MGN 2025 · Simplificación: ytolosa/mapas-colombia (CC BY 4.0)',
    },
    opportunity: { type: 'geojson', data: heat },
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
      'fill-color': ['case', ['in', ['get', 'divipola_dep'], ['literal', activeCodes]], '#1d3a5c', '#16263b'],
    } },
    { id: 'departments-border', type: 'line', source: 'departments', paint: { 'line-color': '#7fa6c7', 'line-width': .8, 'line-opacity': .55 } },
    { id: 'opportunity-heat', type: 'heatmap', source: 'opportunity', paint: {
      'heatmap-weight': ['get', 'weight'],
      'heatmap-intensity': 2.2,
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 40, 5, 95, 8, 180],
      'heatmap-opacity': animate ? 0 : .9,
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(20, 80, 255, 0)', .15, 'rgba(20, 80, 255, .55)', .35, '#00c2ff', .55, '#3cff9a', .72, '#ffe14d', .86, '#ff8a1f', 1, '#ff2d2d'],
    } },
  ].filter(Boolean);
  return { version: 8, sources, layers };
}

export function getEntrancePlan(reducedMotion) {
  if (reducedMotion) return { from: { ...MAP_VIEW }, flyMs: 0, heatDelayMs: 0, heatMs: 0, pinDelayMs: 0, pinStaggerMs: 0 };
  return { from: { zoom: MAP_VIEW.zoom - 1.1, pitch: 0, bearing: 0 }, flyMs: 1200, heatDelayMs: 900, heatMs: 600, pinDelayMs: 1000, pinStaggerMs: 90 };
}

export function shouldPlayMapEntrance(storage = window.sessionStorage) {
  try { return storage.getItem(ENTRANCE_KEY) == null; } catch { return true; }
}

export function markMapEntrancePlayed(storage = window.sessionStorage) {
  try { storage.setItem(ENTRANCE_KEY, '1'); } catch { /* sin almacenamiento: se vuelve a animar */ }
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
  heatLegend.innerHTML = '<strong>Intensidad de oportunidad</strong><div class="map-heat-ramp"></div><div class="map-heat-labels"><span>Baja</span><span>Alta</span></div>';
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
  const [{ Map: MapLibreMap, Popup, Marker, setWorkerUrl }, , response, { default: workerUrl }] = await Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl.css'),
    fetch('/data/colombia-capitals.json'),
    import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
  ]);
  if (!response.ok) throw new Error('No se pudo cargar el catálogo local de ciudades.');
  const capitals = await response.json();
  const states = getDepartmentClientStates(clients, capitals);
  const { groups, warnings } = groupCityClients(clients, capitals);
  if (current !== generation || !container.isConnected) return;
  const activeCodes = [...states].filter(([, state]) => state.clients.length).map(([code]) => code);
  const target = getTodayTarget(zones, capitals);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate = !reduced && shouldPlayMapEntrance();
  const plan = getEntrancePlan(!animate);
  container.classList.add('advisor-map-container');

  setWorkerUrl(workerUrl);
  map = new MapLibreMap({
    container,
    // El relieve viene de internet y se agrega después de cargar: lo local aparece de inmediato.
    style: buildAdvisorMapStyle({ activeCodes, heat: getOpportunityHeat(clients, sales, capitals), relief: false, animate }),
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
  map.on('dragstart', () => { userMoved = true; });
  map.on('resize', () => { if (!userMoved && map) map.jumpTo(finalView()); });
  map.once('load', () => {
    onStatus('ready');
    // Créditos plegados en el botón ⓘ para que no tapen las leyendas.
    container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    const withRelief = buildAdvisorMapStyle({ activeCodes, heat: { type: 'FeatureCollection', features: [] }, relief: true });
    map.addSource('dem', withRelief.sources.dem);
    map.addLayer(withRelief.layers.find(layer => layer.id === 'relief'), 'coast-glow');
    if (!animate) { map.jumpTo(finalView()); return; }
    markMapEntrancePlayed();
    const view = finalView();
    map.jumpTo({ center: view.center, ...plan.from });
    map.flyTo({ ...view, duration: plan.flyMs, essential: true });
    const start = performance.now();
    const fade = now => {
      if (!map) return;
      const progress = Math.min(1, Math.max(0, (now - start - plan.heatDelayMs) / plan.heatMs));
      map.setPaintProperty('opportunity-heat', 'heatmap-opacity', .9 * progress);
      if (progress < 1) requestAnimationFrame(fade);
    };
    requestAnimationFrame(fade);
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
  map.on('mousemove', 'departments-fill', event => {
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
      : 'Departamento bloqueado';
    hoverPopup.setLngLat(event.lngLat).setText(message).addTo(map);
  });
  map.on('mouseleave', 'departments-fill', () => {
    map.getCanvas().style.cursor = '';
    hoverPopup.remove();
  });
  map.on('click', 'departments-fill', event => {
    const code = event.features?.[0]?.properties?.divipola_dep;
    const state = states.get(code);
    if (!state) return;
    hoverPopup.remove();
    detailPopup?.remove();
    const content = document.createElement('div');
    if (!state.clients.length) {
      content.textContent = 'No tienes clientes asignados aquí';
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
  const pins = [];
  for (const group of groups) {
    const progress = { ...getCityProgress(group.clients, sales), target: target?.department === group.department };
    const { root, pin } = createCityPin(group.clients.length, cityLabel(group), progress);
    pin.addEventListener('click', event => {
      event.stopPropagation();
      hoverPopup.remove();
      detailPopup?.remove();
      const content = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = `${group.city}, ${group.department}`;
      const list = document.createElement('ul');
      for (const client of group.clients) {
        const item = document.createElement('li');
        item.textContent = `${client.name} · ${client.type} · ${client.city}, ${client.department}`;
        list.append(item);
      }
      content.append(title, list);
      detailPopup = new Popup().setLngLat(group.coordinates).setDOMContent(content).addTo(map);
    });
    pins.push(pin);
    markers.push(new Marker({ element: root }).setLngLat(group.coordinates).addTo(map));
  }

  const { heatLegend, compass, stateLegend } = createMapOverlays();
  overlays = [heatLegend, compass, stateLegend];
  if (target) {
    overlays.push(createTargetCard(target, () => {
      userMoved = true;
      map?.flyTo({ center: target.coordinates, zoom: finalView().zoom + 1.4, pitch: 50, bearing: MAP_VIEW.bearing, duration: reduced ? 0 : 900, essential: true });
    }));
  }
  container.append(...overlays);
  const needle = compass.querySelector('svg');
  map.on('rotate', () => { needle.style.transform = `rotate(${-map.getBearing()}deg)`; });

  if (warnings.length) {
    warningNode = document.createElement('p');
    warningNode.className = 'advisor-map-warning';
    warningNode.setAttribute('role', 'status');
    warningNode.textContent = `${warnings.length} ${warnings.length === 1 ? 'cliente no se pudo ubicar' : 'clientes no se pudieron ubicar'} en una ciudad del mapa.`;
    container.append(warningNode);
  }
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
