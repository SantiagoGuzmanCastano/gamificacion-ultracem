// Spec del mapa de calor de oportunidad (fase Red).
// Calor = toneladas pedidas por clientes que aún no tienen venta confirmada, agrupadas por ciudad.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getOpportunityHeat } from '../src/advisor-map.js';

const capitals = JSON.parse(readFileSync(new URL('../public/data/colombia-capitals.json', import.meta.url), 'utf8'));
const clients = [
  { id: 'a', department: 'Atlántico', city: 'Barranquilla', tons_requested: 20 },
  { id: 'b', department: 'Atlántico', city: 'Barranquilla', tons_requested: 35 },
  { id: 'c', department: 'Antioquia', city: 'Medellín', tons_requested: 15 },
  { id: 'd', department: 'Antioquia', city: 'Medellín', tons_requested: 40 },
  { id: 'e', department: null, city: null, tons_requested: 50 },
];
const sales = [
  { client_id: 'c', confirmed: true },
  { client_id: 'd', confirmed: false },
];

describe('mapa de calor de oportunidad', () => {
  it('suma por ciudad las toneladas de los clientes sin venta confirmada', () => {
    const heat = getOpportunityHeat(clients, sales, capitals);
    expect(heat.type).toBe('FeatureCollection');
    const byCity = Object.fromEntries(heat.features.map(feature => [feature.properties.city, feature.properties.tons]));
    expect(byCity).toEqual({ Barranquilla: 55, Medellín: 40 });
  });

  it('cada punto va en las coordenadas de su ciudad', () => {
    const heat = getOpportunityHeat(clients, sales, capitals);
    const medellin = capitals.find(capital => capital.name === 'Medellín');
    const point = heat.features.find(feature => feature.properties.city === 'Medellín');
    expect(point.geometry).toEqual({ type: 'Point', coordinates: [medellin.longitude, medellin.latitude] });
  });

  it('el peso va de 0 a 1 respecto a la ciudad con más oportunidad', () => {
    const heat = getOpportunityHeat(clients, sales, capitals);
    const weights = Object.fromEntries(heat.features.map(feature => [feature.properties.city, feature.properties.weight]));
    expect(weights.Barranquilla).toBe(1);
    expect(weights.Medellín).toBeCloseTo(40 / 55);
  });

  it('sin oportunidad pendiente no hay puntos', () => {
    const sold = clients.map(client => ({ client_id: client.id, confirmed: true }));
    expect(getOpportunityHeat(clients, sold, capitals).features).toEqual([]);
    expect(getOpportunityHeat([], [], capitals).features).toEqual([]);
  });
});
