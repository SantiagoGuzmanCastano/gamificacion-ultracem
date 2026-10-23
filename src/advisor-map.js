let map;
let hoverPopup;
let detailPopup;
let markers = [];
let warningNode;
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

export async function renderAdvisorClientMap(container, clients = [], onStatus = () => {}, sales = []) {
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
  container.classList.add('advisor-map-container');

  setWorkerUrl(workerUrl);
  map = new MapLibreMap({
    container,
    style: {
      version: 8,
      sources: {
        departments: {
          type: 'geojson',
          data: '/data/colombia-departments.geojson',
          attribution: 'Cartografía: DANE MGN 2025 · Simplificación: ytolosa/mapas-colombia (CC BY 4.0)',
        },
        opportunity: { type: 'geojson', data: getOpportunityHeat(clients, sales, capitals) },
      },
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#08121f' } },
        { id: 'departments-fill', type: 'fill', source: 'departments', paint: {
          'fill-color': ['case', ['in', ['get', 'divipola_dep'], ['literal', activeCodes]], '#1378c6', '#1b3047'],
          'fill-opacity': 1,
        } },
        { id: 'departments-border', type: 'line', source: 'departments', paint: { 'line-color': '#7892aa', 'line-width': 1 } },
        { id: 'opportunity-heat', type: 'heatmap', source: 'opportunity', paint: {
          'heatmap-weight': ['get', 'weight'],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 1, 8, 2],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 60, 8, 110],
          'heatmap-opacity': .85,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(255, 201, 40, 0)', .2, 'rgba(255, 201, 40, .35)', .5, '#ffc928', .8, '#ff8a1f', 1, '#ff4d2e'],
        } },
      ],
    },
    bounds: [[-81.8, -4.3], [-66.8, 13.5]],
    fitBoundsOptions: { padding: 24 },
  });
  map.once('load', () => onStatus('ready'));
  map.on('error', event => onStatus('error', `No se pudo cargar el mapa: ${event.error?.message || 'error desconocido'}`));

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

  for (const group of groups) {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'advisor-city-marker';
    control.textContent = String(group.clients.length);
    control.setAttribute('aria-label', `${group.city}, ${group.department}: ${group.clients.length} clientes`);
    control.addEventListener('click', event => {
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
    markers.push(new Marker({ element: control, anchor: 'bottom' }).setLngLat(group.coordinates).addTo(map));
  }

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
  warningNode?.remove();
  warningNode = undefined;
  hoverPopup = detailPopup = undefined;
  map?.remove();
  map = undefined;
}
