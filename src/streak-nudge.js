import { advisorIcon } from './advisor-icons.js';

// Mala racha = 0 días. Topitín anima sin regañar ni comparar con otros asesores.
export const STREAK_NUDGES = [
  '¡Hola! Hoy es un buen día para empezar una racha nueva.',
  'Una venta confirmada hoy enciende tu racha. ¡Yo te acompaño!',
  'Cada paso cuenta. ¿Empezamos con la primera tarea?',
];
const STORAGE_KEY = 'ultracem-streak-nudge';

export function getStreakNudge(streak, dayIndex = new Date().getDate()) {
  return streak > 0 ? null : STREAK_NUDGES[dayIndex % STREAK_NUDGES.length];
}

export function shouldShowStreakNudge(streak, storage = window.sessionStorage) {
  if (streak > 0) return false;
  try { return storage.getItem(STORAGE_KEY) == null; } catch { return true; }
}

export function markStreakNudgeShown(storage = window.sessionStorage) {
  try { storage.setItem(STORAGE_KEY, '1'); } catch { /* sin almacenamiento: puede volver a salir */ }
}

// Con racha la llama titila (CSS, [data-streak="hot"]); en 0 queda gris y quieta.
export function createStreakStat(streak) {
  const stat = document.createElement('div');
  stat.className = 'hero-highlight hero-streak';
  stat.dataset.streak = streak > 0 ? 'hot' : 'cold';
  const flame = document.createElement('span');
  flame.className = 'hero-highlight-icon hero-streak-flame';
  flame.setAttribute('aria-hidden', 'true');
  flame.innerHTML = advisorIcon('flame');
  const label = document.createElement('span');
  label.textContent = 'Racha actual';
  const value = document.createElement('strong');
  value.textContent = `${streak} ${streak === 1 ? 'día' : 'días'}`;
  stat.append(flame, label, value);
  return stat;
}

export function showStreakNudge(mascot, { message, onTasks, onClose = () => {} }) {
  mascot.querySelector('.mascot-nudge')?.remove();
  const bubble = document.createElement('div');
  bubble.className = 'mascot-nudge';
  bubble.setAttribute('role', 'status');
  const text = document.createElement('p');
  text.className = 'mascot-nudge-text';
  text.textContent = message;
  const actions = document.createElement('div');
  actions.className = 'mascot-nudge-actions';
  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'mascot-nudge-primary';
  go.textContent = 'Ver mis tareas';
  go.addEventListener('click', () => { bubble.remove(); onClose(); onTasks(); });
  const later = document.createElement('button');
  later.type = 'button';
  later.textContent = 'Ahora no';
  later.addEventListener('click', () => { bubble.remove(); onClose(); });
  actions.append(go, later);
  bubble.append(text, actions);
  mascot.append(bubble);
  return bubble;
}
