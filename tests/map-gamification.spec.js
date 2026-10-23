// @vitest-environment jsdom
// Spec (fase Red) de la gamificación del mapa.
// PRD · Ver la oportunidad por zona:
//   - Cada zona muestra participación actual, participación objetivo, la brecha y la oportunidad en toneladas.
//   - Cada zona muestra clientes totales, clientes atendidos y clientes por atender.
//   - Las zonas se ordenan de mayor a menor oportunidad. Las que están en "Defender" van al final.
// Decisiones: zona = departamento; objetivo = 10 % (meta del PRD); atendido = con venta confirmada;
// mercado por zona = archivo de Muestra; la zona objetivo de hoy = la 1.ª zona en "Atacar".
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  createCityPin, createTargetCard, createZoneList, getCityProgress, getTodayTarget, getZoneOpportunities,
} from '../src/advisor-map.js';

// En jsdom, URL es la del navegador: se lee con una ruta en texto.
const capitals = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/colombia-capitals.json'), 'utf8'));
const tasks = done => Array.from({ length: 4 }, (_, index) => ({ completed: index < done }));
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

describe('oportunidad por zona (PRD)', () => {
  const zones = getZoneOpportunities(market, clients, sales);
  const byName = Object.fromEntries(zones.map(zone => [zone.department, zone]));

  it('cada zona trae participación actual, objetivo, brecha y oportunidad en toneladas', () => {
    expect(byName['Atlántico']).toMatchObject({ share: 6, targetShare: 10, gapPp: 4, opportunityTons: 4000, status: 'attack' });
    expect(byName['Antioquia']).toMatchObject({ share: 9, gapPp: 1, opportunityTons: 2000, status: 'attack' });
  });

  it('si la zona supera su objetivo: oportunidad 0 y "Defender"', () => {
    expect(byName['Bolívar']).toMatchObject({ share: 12, gapPp: 0, opportunityTons: 0, status: 'defend' });
  });

  it('cada zona trae clientes totales, atendidos (con venta confirmada) y por atender', () => {
    expect(byName['Atlántico'].clients).toEqual({ total: 2, attended: 1, pending: 1 });
    expect(byName['Bolívar'].clients).toEqual({ total: 1, attended: 1, pending: 0 });
    expect(byName['Antioquia'].clients).toEqual({ total: 1, attended: 0, pending: 1 });
  });

  it('se ordena de mayor a menor oportunidad y las de "Defender" van al final', () => {
    expect(zones.map(zone => zone.department)).toEqual(['Atlántico', 'Antioquia', 'Bolívar']);
  });

  it('el asesor puede ver solo las zonas donde tiene clientes; el admin, todas', () => {
    const own = getZoneOpportunities(market, clients.filter(client => client.department === 'Atlántico'), sales, { onlyWithClients: true });
    expect(own.map(zone => zone.department)).toEqual(['Atlántico']);
    expect(getZoneOpportunities(market, [], [])).toHaveLength(3);
  });

  it('la lista muestra cada cifra con texto y formato §14, y avisa que son datos de muestra', () => {
    const list = createZoneList(zones, { sample: true });
    const items = [...list.querySelectorAll('.zone-item')];
    expect(items.map(item => item.querySelector('h3').textContent)).toEqual(['Atlántico', 'Antioquia', 'Bolívar']);
    const first = items[0].textContent;
    expect(first).toContain('Participación 6 % → 10 %');
    expect(first).toContain('Brecha 4 pp');
    expect(first).toContain('Oportunidad 4.000 t');
    expect(first).toContain('2 clientes · 1 atendido · 1 por atender');
    const chip = items[0].querySelector('.zone-status');
    expect(chip.dataset.status).toBe('attack');
    expect(chip.textContent).toBe('Atacar');
    expect(chip.querySelector('svg')).not.toBeNull();
    expect(items[2].querySelector('.zone-status').textContent).toBe('Defender');
    expect(list.textContent).toContain('Datos de muestra');
  });
});

describe('zona objetivo de hoy', () => {
  const zones = getZoneOpportunities(market, clients, sales);

  it('es la primera zona en "Atacar" y explica por qué con sus cifras', () => {
    expect(getTodayTarget(zones, capitals)).toMatchObject({
      department: 'Atlántico', opportunityTons: 4000,
      reason: 'Brecha de 4 pp en Atlántico: 4.000 t de oportunidad y 1 cliente por atender.',
    });
  });

  it('trae las coordenadas de la capital para ir a la zona en el mapa', () => {
    const capital = capitals.find(item => item.department === 'Atlántico');
    expect(getTodayTarget(zones, capitals).coordinates).toEqual([capital.longitude, capital.latitude]);
  });

  it('si todas las zonas están en "Defender" no hay zona objetivo', () => {
    const allDefend = { ...market, zones: market.zones.map(zone => ({ ...zone, ultracemTons: zone.marketTons * 0.2 })) };
    expect(getTodayTarget(getZoneOpportunities(allDefend, clients, sales), capitals)).toBeNull();
  });

  it('la tarjeta muestra el título, la zona, la razón y un botón que lleva a ella', () => {
    const onFocus = vi.fn();
    const card = createTargetCard(getTodayTarget(zones, capitals), onFocus);
    expect(card.getAttribute('role')).toBe('status');
    expect(card.querySelector('h3').textContent).toBe('Zona objetivo de hoy');
    expect(card.querySelector('.map-target-zone').textContent).toBe('Atlántico');
    expect(card.textContent).toContain('Brecha de 4 pp en Atlántico: 4.000 t de oportunidad y 1 cliente por atender.');
    const go = card.querySelector('button');
    expect(go.textContent).toBe('Ver en el mapa');
    go.click();
    expect(onFocus).toHaveBeenCalledOnce();
  });
});

describe('pines con progreso', () => {
  it('calcula el % de tareas de los clientes de la ciudad', () => {
    expect(getCityProgress(clients.slice(0, 2), [])).toEqual({ percent: 75, sold: false });
  });

  it('queda dorado (vendido) cuando todos los clientes de la ciudad tienen venta confirmada', () => {
    expect(getCityProgress([clients[2]], sales)).toEqual({ percent: 100, sold: true });
    expect(getCityProgress([clients[2]], [])).toEqual({ percent: 100, sold: false });
  });

  it('el pin lleva el anillo de progreso y lo dice con texto, no solo con color', () => {
    const { pin } = createCityPin(2, 'Barranquilla, Atlántico: 2 clientes', { percent: 75, sold: false });
    expect(pin.style.getPropertyValue('--pin-progress')).toBe('75%');
    expect(pin.dataset.state).toBe('progress');
    expect(pin.getAttribute('aria-label')).toBe('Barranquilla, Atlántico: 2 clientes · 75 % de tareas');
  });

  it('un pin vendido se marca como vendido', () => {
    const { pin } = createCityPin(1, 'Cartagena de Indias, Bolívar: 1 cliente', { percent: 100, sold: true });
    expect(pin.dataset.state).toBe('sold');
    expect(pin.getAttribute('aria-label')).toBe('Cartagena de Indias, Bolívar: 1 cliente · venta confirmada');
  });

  it('los pines de la zona objetivo se resaltan', () => {
    const { pin } = createCityPin(2, 'Barranquilla, Atlántico: 2 clientes', { percent: 75, sold: false, target: true });
    expect(pin.classList.contains('is-target')).toBe(true);
  });
});
