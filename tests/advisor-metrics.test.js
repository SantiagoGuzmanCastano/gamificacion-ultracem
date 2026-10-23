import test from 'node:test';
import assert from 'node:assert/strict';
import { getMonthlyTons, getSalesStreak, getWeeklySales } from '../src/advisor-metrics.js';

const advisorId = 'advisor-1';
const now = new Date(2026, 9, 21, 12);
const sale = (confirmedAt, tons = 10, overrides = {}) => ({
  advisor_id: advisorId,
  confirmed: true,
  confirmed_at: confirmedAt,
  tons_sold: tons,
  ...overrides,
});

test('suma solo toneladas confirmadas del mes y asesor actuales', () => {
  const sales = [
    sale(new Date(2026, 9, 2, 9), 12.5),
    sale(new Date(2026, 9, 21, 10), 7.5),
    sale(new Date(2026, 8, 30, 10), 99),
    sale(null, 50),
    sale(new Date(2026, 9, 21, 10), 30, { confirmed: false }),
    sale(new Date(2026, 9, 21, 10), 40, { advisor_id: 'advisor-2' }),
  ];

  assert.equal(getMonthlyTons(sales, advisorId, now), 20);
});

test('agrupa ventas confirmadas de lunes a domingo de la semana actual', () => {
  const sales = [
    sale(new Date(2026, 9, 19, 8)),
    sale(new Date(2026, 9, 19, 14)),
    sale(new Date(2026, 9, 21, 11)),
    sale(new Date(2026, 9, 26, 11)),
    sale(null),
  ];

  assert.deepEqual(getWeeklySales(sales, advisorId, now).map(day => day.count), [2, 0, 1, 0, 0, 0, 0]);
  assert.deepEqual(getWeeklySales(sales, advisorId, now).map(day => day.label), ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);
});

test('calcula una racha de días consecutivos que termina hoy', () => {
  const sales = [
    sale(new Date(2026, 9, 21, 9)),
    sale(new Date(2026, 9, 20, 16)),
    sale(new Date(2026, 9, 19, 11)),
    sale(new Date(2026, 9, 17, 11)),
  ];

  assert.equal(getSalesStreak(sales, advisorId, now), 3);
  // Sin venta hoy, la racha cuenta desde ayer (20 y 19).
  assert.equal(getSalesStreak(sales.slice(1), advisorId, now), 2);
});
