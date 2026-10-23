// Recordatorio amable (V5): después de la hora de corte, si hoy no hay tareas completadas.
// Hora de corte 14:00 = Propuesta del contexto; el mensaje nunca menciona a otros asesores.
export const REMINDER_CUTOFF_HOUR = 14;
export const REMINDER_MESSAGE = 'Aún tienes tiempo hoy. Una tarea pequeña mantiene tu ritmo.';

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function isReminderDue(tasks, now = new Date()) {
  if (now.getHours() < REMINDER_CUTOFF_HOUR) return false;
  if (!tasks.some(task => !task.completed)) return false;
  return !tasks.some(task => task.completed_at && sameDay(new Date(task.completed_at), now));
}
