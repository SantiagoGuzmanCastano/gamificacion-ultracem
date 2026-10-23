// Spec (fase Red): recordatorio amable (V5, PRD) y formato de porcentaje (§14 de CLAUDE.md).
// Hora de corte = 14:00 (Propuesta del contexto). El mensaje nunca menciona a otros asesores.
import { describe, expect, it } from 'vitest';
import { REMINDER_MESSAGE, isReminderDue } from '../src/reminder.js';
import { formatPercent } from '../src/format.js';

const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute);
const task = completedAt => ({ completed: Boolean(completedAt), completed_at: completedAt ? completedAt.toISOString() : null });

describe('recordatorio amable', () => {
  it('antes de las 14:00 no aparece', () => {
    expect(isReminderDue([task(null)], at(22, 13, 59))).toBe(false);
  });

  it('desde las 14:00 aparece si hoy no completaste ninguna tarea', () => {
    expect(isReminderDue([task(null), task(at(21, 10))], at(22, 14))).toBe(true);
  });

  it('no aparece si hoy ya completaste una tarea', () => {
    expect(isReminderDue([task(at(22, 9)), task(null)], at(22, 15))).toBe(false);
  });

  it('no aparece si no hay tareas pendientes', () => {
    expect(isReminderDue([task(at(21, 9))], at(22, 15))).toBe(false);
    expect(isReminderDue([], at(22, 15))).toBe(false);
  });

  it('el mensaje es amable, corto y no compara', () => {
    expect(REMINDER_MESSAGE).toBe('Aún tienes tiempo hoy. Una tarea pequeña mantiene tu ritmo.');
    expect(REMINDER_MESSAGE).not.toMatch(/asesor|otros|ranking|deberías/i);
  });
});

describe('formato de porcentaje', () => {
  it('lleva espacio antes de % y coma decimal', () => {
    expect(formatPercent(50)).toBe('50 %');
    expect(formatPercent(7.83)).toBe('7,83 %');
    expect(formatPercent(100)).toBe('100 %');
  });
});
