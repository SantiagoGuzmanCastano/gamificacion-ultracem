// @vitest-environment jsdom
// Spec (fase Red): enfocar una zona del mapa.
// Al hacer clic en un departamento (con clientes) o en una zona de la lista "Oportunidad por zona":
// la cámara vuela a la zona, el resto se atenúa, el borde de la zona brilla, su calor aparece de 0 al valor
// y una tarjeta muestra sus cifras con el botón "Ver todo" para volver.
import { describe, expect, it, vi } from 'vitest';
import {
  createZoneFocusCard, createZoneList, focusFillColor, getFeatureBounds, getFocusPlan, zoneHeatFilter,
} from '../src/advisor-map.js';

const zone = {
  code: '08', department: 'Atlántico', share: 6.96, targetShare: 10, gapPp: 3.04, opportunityTons: 6361, status: 'attack',
  clients: { total: 2, attended: 1, pending: 1 },
};
const defended = { ...zone, code: '13', department: 'Bolívar', share: 12.7, gapPp: 0, opportunityTons: 0, status: 'defend' };

describe('geometría de la zona', () => {
  it('calcula el rectángulo de un polígono', () => {
    const feature = { geometry: { type: 'Polygon', coordinates: [[[-75, 10], [-74, 11], [-74.5, 10.2], [-75, 10]]] } };
    expect(getFeatureBounds(feature)).toEqual([[-75, 10], [-74, 11]]);
  });

  it('y de un multipolígono (islas incluidas)', () => {
    const feature = { geometry: { type: 'MultiPolygon', coordinates: [[[[-81.7, 12.5], [-81.6, 12.6], [-81.7, 12.5]]], [[[-75, 10], [-74, 11], [-75, 10]]]] } };
    expect(getFeatureBounds(feature)).toEqual([[-81.7, 10], [-74, 12.6]]);
  });
});

describe('estilo del enfoque', () => {
  it('la zona enfocada se pinta distinto y el resto se atenúa', () => {
    const focused = JSON.stringify(focusFillColor(['08', '13'], '08'));
    expect(focused).toContain('"08"');
    expect(focused).not.toEqual(JSON.stringify(focusFillColor(['08', '13'], null)));
  });

  it('sin zona enfocada vuelve a los colores de siempre (con clientes / bloqueado)', () => {
    expect(JSON.stringify(focusFillColor(['08'], null))).toContain('"08"');
  });

  it('el calor de la zona se filtra por su departamento', () => {
    expect(zoneHeatFilter('Atlántico')).toEqual(['==', ['get', 'department'], 'Atlántico']);
  });

  it('con movimiento: vuelo de 0,9 s y el calor de la zona aparece en 0,6 s; el resto queda tenue', () => {
    expect(getFocusPlan(false)).toEqual({ flyMs: 900, heatMs: 600, dimHeatOpacity: .25 });
  });

  it('con "reducir movimiento" todo aparece directo', () => {
    expect(getFocusPlan(true)).toEqual({ flyMs: 0, heatMs: 0, dimHeatOpacity: .25 });
  });
});

describe('tarjeta de la zona enfocada', () => {
  it('muestra las cifras de la zona y su estado con ícono y texto', () => {
    const card = createZoneFocusCard(zone, () => {});
    expect(card.getAttribute('role')).toBe('status');
    expect(card.querySelector('h3').textContent).toBe('Atlántico');
    expect(card.querySelector('.zone-status').textContent).toBe('Atacar');
    expect(card.querySelector('.zone-status svg')).not.toBeNull();
    expect(card.textContent).toContain('Participación 6,96 % → 10 %');
    expect(card.textContent).toContain('Brecha 3,04 pp · Oportunidad 6.361 t');
    expect(card.textContent).toContain('2 clientes · 1 atendido · 1 por atender');
  });

  it('una zona en "Defender" lo dice', () => {
    expect(createZoneFocusCard(defended, () => {}).querySelector('.zone-status').textContent).toBe('Defender');
  });

  it('"Ver todo" vuelve a la vista completa', () => {
    const onReset = vi.fn();
    const card = createZoneFocusCard(zone, onReset);
    const back = card.querySelector('button');
    expect(back.textContent).toBe('Ver todo');
    back.click();
    expect(onReset).toHaveBeenCalledOnce();
  });
});

describe('lista de zonas que enfoca el mapa', () => {
  it('con onSelect cada zona tiene un botón que la enfoca en el mapa', () => {
    const onSelect = vi.fn();
    const list = createZoneList([zone, defended], { onSelect });
    const buttons = [...list.querySelectorAll('.zone-item-focus')];
    expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual(['Enfocar Atlántico en el mapa', 'Enfocar Bolívar en el mapa']);
    buttons[1].click();
    expect(onSelect).toHaveBeenCalledWith(defended);
  });

  it('sin onSelect (admin) la lista no tiene botones', () => {
    expect(createZoneList([zone]).querySelector('.zone-item-focus')).toBeNull();
  });
});
