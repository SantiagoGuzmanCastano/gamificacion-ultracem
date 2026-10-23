// @vitest-environment jsdom
// Spec del mapa de calor 3D (fase Red), según la referencia aprobada:
// vista inclinada, Colombia como losa, relieve y vecinos con brillo, calor azul→rojo,
// leyendas de vidrio, brújula y entrada animada de ~1,6 s (una vez por sesión).
import { describe, expect, it } from 'vitest';
import {
  GEO_LABELS, MAP_VIEW, buildAdvisorMapStyle, createCityPin, createMapOverlays, getEntrancePlan,
  markMapEntrancePlayed, shouldPlayMapEntrance,
} from '../src/advisor-map.js';

const heat = { type: 'FeatureCollection', features: [] };
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) }; };

describe('estilo del mapa', () => {
  const style = buildAdvisorMapStyle({ activeCodes: ['08', '05'], heat, relief: true, animate: true });
  const ids = style.layers.map(layer => layer.id);

  it('apila las capas como la referencia: relieve y vecinos abajo, losa de Colombia y calor encima', () => {
    expect(ids).toEqual([
      'background', 'land', 'relief', 'coast-glow', 'country-glow',
      'slab-shadow', 'slab-side', 'departments-fill', 'departments-border', 'opportunity-heat',
    ]);
  });

  it('la losa se arma con copias desplazadas hacia abajo (sin extrusión que tape el calor)', () => {
    const side = style.layers.find(layer => layer.id === 'slab-side');
    expect(side.paint['fill-translate-anchor']).toBe('viewport');
    expect(side.paint['fill-translate'][1]).toBeGreaterThan(0);
    expect(style.layers.some(layer => layer.type === 'fill-extrusion')).toBe(false);
  });

  it('usa relieve Terrarium de AWS y vecinos locales, con sus créditos', () => {
    expect(style.sources.dem).toMatchObject({ type: 'raster-dem', encoding: 'terrarium' });
    expect(style.sources.dem.tiles[0]).toContain('elevation-tiles-prod/terrarium');
    expect(style.sources.neighbors.data).toBe('/data/neighbors.geojson');
    const credits = Object.values(style.sources).map(source => source.attribution || '').join(' ');
    expect(credits).toContain('Natural Earth');
    expect(credits).toContain('Terrain Tiles');
    expect(credits).toContain('DANE');
  });

  it('sin relieve no pide nada a internet', () => {
    const offline = buildAdvisorMapStyle({ activeCodes: [], heat, relief: false, animate: false });
    expect(offline.sources.dem).toBeUndefined();
    expect(offline.layers.some(layer => layer.id === 'relief')).toBe(false);
  });

  it('los departamentos con clientes se pintan distinto', () => {
    const fill = style.layers.find(layer => layer.id === 'departments-fill');
    expect(JSON.stringify(fill.paint['fill-color'])).toContain('"08","05"');
  });

  it('el calor va de azul transparente a rojo y arranca invisible si hay animación', () => {
    const layer = style.layers.find(item => item.id === 'opportunity-heat');
    const ramp = layer.paint['heatmap-color'];
    expect(ramp[3]).toBe(0);
    expect(ramp[4]).toMatch(/^rgba\(20, ?80, ?255, ?0\)$/);
    expect(ramp.at(-1)).toBe('#ff2d2d');
    expect(layer.paint['heatmap-opacity']).toBe(0);
    const still = buildAdvisorMapStyle({ activeCodes: [], heat, relief: false, animate: false });
    expect(still.layers.find(item => item.id === 'opportunity-heat').paint['heatmap-opacity']).toBeGreaterThan(0.8);
  });
});

describe('cámara y entrada animada', () => {
  it('la vista final es inclinada como la referencia', () => {
    expect(MAP_VIEW.pitch).toBeGreaterThanOrEqual(40);
    expect(MAP_VIEW.zoom).toBeGreaterThan(4);
  });

  it('con movimiento: vuelo de 1,2 s desde arriba, calor en 0,6 s y pines en cascada; todo en ~1,6 s', () => {
    const plan = getEntrancePlan(false);
    expect(plan.from).toMatchObject({ pitch: 0, bearing: 0 });
    expect(plan.from.zoom).toBeLessThan(MAP_VIEW.zoom);
    expect(plan.flyMs).toBe(1200);
    expect(plan.heatMs).toBe(600);
    expect(plan.heatDelayMs + plan.heatMs).toBeLessThanOrEqual(1600);
    expect(plan.pinStaggerMs).toBeGreaterThan(0);
  });

  it('con "reducir movimiento" el mapa aparece directo', () => {
    expect(getEntrancePlan(true)).toMatchObject({ flyMs: 0, heatMs: 0, heatDelayMs: 0, pinStaggerMs: 0 });
  });

  it('la entrada se ve una sola vez por sesión, aunque falle el almacenamiento', () => {
    const storage = memory();
    expect(shouldPlayMapEntrance(storage)).toBe(true);
    markMapEntrancePlayed(storage);
    expect(shouldPlayMapEntrance(storage)).toBe(false);
    const blocked = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
    expect(shouldPlayMapEntrance(blocked)).toBe(true);
    expect(() => markMapEntrancePlayed(blocked)).not.toThrow();
  });
});

describe('piezas sobre el mapa', () => {
  it('el pin se anima por dentro: el marcador queda libre para que MapLibre lo ubique', () => {
    const { root, pin } = createCityPin(3, 'Barranquilla, Atlántico: 3 clientes');
    expect(root.style.transform).toBe('');
    expect(root.contains(pin)).toBe(true);
    expect(pin.tagName).toBe('BUTTON');
    expect(pin.classList.contains('advisor-city-marker')).toBe(true);
    expect(pin.textContent).toBe('3');
    expect(pin.getAttribute('aria-label')).toBe('Barranquilla, Atlántico: 3 clientes');
  });

  it('trae leyenda de calor, brújula y leyenda de estados, con texto (no solo color)', () => {
    const { heatLegend, compass, stateLegend } = createMapOverlays();
    expect(heatLegend.textContent).toContain('Intensidad de oportunidad');
    expect(heatLegend.textContent).toContain('Baja');
    expect(heatLegend.textContent).toContain('Alta');
    expect(heatLegend.querySelector('.map-heat-ramp')).not.toBeNull();
    expect(compass.querySelector('svg')).not.toBeNull();
    expect(compass.getAttribute('aria-hidden')).toBe('true');
    expect(stateLegend.textContent).toContain('Bloqueado');
    expect(stateLegend.textContent).toContain('Con clientes');
  });

  it('nombra los mares y los vecinos como en la referencia', () => {
    expect(GEO_LABELS.map(label => label.text)).toEqual(expect.arrayContaining([
      'Mar Caribe', 'Océano Pacífico', 'Venezuela', 'Brasil', 'Ecuador', 'Perú', 'Panamá',
    ]));
  });
});
