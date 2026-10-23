// Spec (fase Red): la racha no se reinicia cada mañana y "Limpiar tareas" solo aparece con la venta confirmada.
import { describe, expect, it } from 'vitest';
import { canClearCompletedTasks, getSalesStreak } from '../src/advisor-metrics.js';

const advisorId = 'advisor-1';
const now = new Date(2026, 9, 21, 12);
const sale = day => ({ advisor_id: advisorId, confirmed: true, confirmed_at: new Date(2026, 9, day, 10) });

describe('racha de ventas', () => {
  it('con venta hoy cuenta desde hoy', () => {
    expect(getSalesStreak([sale(21), sale(20), sale(19)], advisorId, now)).toBe(3);
  });

  it('si hoy todavía no hay venta, cuenta desde ayer (no se pierde en la mañana)', () => {
    expect(getSalesStreak([sale(20), sale(19)], advisorId, now)).toBe(2);
  });

  it('si ayer tampoco hubo venta, la racha está en 0', () => {
    expect(getSalesStreak([sale(19), sale(18)], advisorId, now)).toBe(0);
  });
});

describe('limpiar tareas completadas', () => {
  const client = { id: 'c1', tasks: Array.from({ length: 4 }, () => ({ completed: true })) };

  it('no se puede limpiar con 4/4 si la venta no está confirmada', () => {
    expect(canClearCompletedTasks(client, [])).toBe(false);
    expect(canClearCompletedTasks(client, [{ client_id: 'c1', confirmed: false }])).toBe(false);
  });

  it('se puede limpiar cuando la venta ya está confirmada', () => {
    expect(canClearCompletedTasks(client, [{ client_id: 'c1', confirmed: true }])).toBe(true);
  });

  it('no se puede limpiar si faltan tareas', () => {
    const partial = { id: 'c1', tasks: [{ completed: true }, { completed: false }, { completed: true }, { completed: true }] };
    expect(canClearCompletedTasks(partial, [{ client_id: 'c1', confirmed: true }])).toBe(false);
  });
});
