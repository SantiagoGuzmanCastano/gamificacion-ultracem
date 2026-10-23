import test from 'node:test';
import assert from 'node:assert/strict';
import { getMonthlyTons, getRankingGap, getSalesStreak, getTodaySales, getWeeklySales } from '../src/advisor-metrics.js';

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
  assert.equal(getSalesStreak(sales.slice(1), advisorId, now), 0);
});

test('la semana también suma toneladas por día', () => {
  const sales = [sale(new Date(2026, 9, 19, 8), 12.5), sale(new Date(2026, 9, 19, 14), 7.5), sale(new Date(2026, 9, 21, 11), 4)];
  assert.deepEqual(getWeeklySales(sales, advisorId, now).map(day => day.tons), [20, 0, 4, 0, 0, 0, 0]);
});

test('resume solo las ventas confirmadas de hoy', () => {
  const sales = [
    sale(new Date(2026, 9, 21, 8), 6),
    sale(new Date(2026, 9, 21, 15), 4.5),
    sale(new Date(2026, 9, 20, 15), 30),
    sale(new Date(2026, 9, 21, 9), 9, { confirmed: false }),
  ];
  assert.deepEqual(getTodaySales(sales, advisorId, now), { count: 2, tons: 10.5 });
});

test('calcula las ventas para subir de puesto o la ventaja del primero', () => {
  const rows = [
    { advisor_id: 'a', position: 1, confirmed_sales: 9 },
    { advisor_id: advisorId, position: 2, confirmed_sales: 4 },
    { advisor_id: 'c', position: 3, confirmed_sales: 2 },
  ];
  assert.deepEqual(getRankingGap(rows, advisorId), { kind: 'climb', target: 1, value: 6 });
  assert.deepEqual(getRankingGap(rows, 'a'), { kind: 'lead', value: 5 });
  assert.equal(getRankingGap(rows, 'nadie'), null);
});
