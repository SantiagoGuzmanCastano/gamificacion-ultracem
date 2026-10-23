// @vitest-environment jsdom
// Spec de la racha viva y de Topitín hablando en mala racha (fase Red).
// Mala racha = 0 días. Los textos son la propuesta aprobada; se pueden ajustar.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STREAK_NUDGES, createStreakStat, getStreakNudge, markStreakNudgeShown, shouldShowStreakNudge, showStreakNudge,
} from '../src/streak-nudge.js';
import { getMascotFeedbackMessage } from '../src/mascot-feedback.js';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
};

describe('fuego de la racha', () => {
  it('con racha viva el fuego queda encendido y dice los días', () => {
    const stat = createStreakStat(3);
    expect(stat.classList.contains('hero-highlight')).toBe(true);
    expect(stat.dataset.streak).toBe('hot');
    expect(stat.querySelector('.hero-streak-flame svg')).not.toBeNull();
    expect(stat.querySelector('.hero-streak-flame').getAttribute('aria-hidden')).toBe('true');
    expect(stat.querySelector('strong').textContent).toBe('3 días');
    expect(stat.textContent).toContain('Racha actual');
  });

  it('con 1 día usa singular', () => {
    expect(createStreakStat(1).querySelector('strong').textContent).toBe('1 día');
  });

  it('con 0 días el fuego queda apagado', () => {
    const stat = createStreakStat(0);
    expect(stat.dataset.streak).toBe('cold');
    expect(stat.querySelector('strong').textContent).toBe('0 días');
  });
});

describe('mensaje de Topitín en mala racha', () => {
  it('tiene tres mensajes amables, sin regaños ni comparaciones', () => {
    expect(STREAK_NUDGES).toEqual([
      '¡Hola! Hoy es un buen día para empezar una racha nueva.',
      'Una venta confirmada hoy enciende tu racha. ¡Yo te acompaño!',
      'Cada paso cuenta. ¿Empezamos con la primera tarea?',
    ]);
    for (const message of STREAK_NUDGES) expect(message).not.toMatch(/otros asesores|deberías|fallaste|perdiste/i);
  });

  it('solo habla con racha en 0 y rota el mensaje según el día', () => {
    expect(getStreakNudge(2, 0)).toBeNull();
    expect(getStreakNudge(0, 0)).toBe(STREAK_NUDGES[0]);
    expect(getStreakNudge(0, 4)).toBe(STREAK_NUDGES[1]);
  });

  it('sale una sola vez por sesión', () => {
    const storage = memoryStorage();
    expect(shouldShowStreakNudge(0, storage)).toBe(true);
    expect(shouldShowStreakNudge(5, storage)).toBe(false);
    markStreakNudgeShown(storage);
    expect(shouldShowStreakNudge(0, storage)).toBe(false);
  });

  it('si el navegador bloquea el almacenamiento igual se muestra, sin romper', () => {
    const blocked = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
    expect(shouldShowStreakNudge(0, blocked)).toBe(true);
    expect(() => markStreakNudgeShown(blocked)).not.toThrow();
  });
});

describe('burbuja estilo Duolingo junto a Topitín', () => {
  let mascot;

  beforeEach(() => {
    document.body.innerHTML = '<div class="advisor-hero-mascot"><img class="mascot-image" alt=""></div>';
    mascot = document.querySelector('.advisor-hero-mascot');
  });

  it('muestra el mensaje como estado accesible con dos botones', () => {
    showStreakNudge(mascot, { message: STREAK_NUDGES[0], onTasks() {} });
    const bubble = mascot.querySelector('.mascot-nudge');
    expect(bubble.getAttribute('role')).toBe('status');
    expect(bubble.querySelector('.mascot-nudge-text').textContent).toBe(STREAK_NUDGES[0]);
    expect([...bubble.querySelectorAll('button')].map(button => button.textContent)).toEqual(['Ver mis tareas', 'Ahora no']);
  });

  it('"Ahora no" la cierra', () => {
    showStreakNudge(mascot, { message: STREAK_NUDGES[0], onTasks() {} });
    mascot.querySelector('.mascot-nudge button:last-child').click();
    expect(mascot.querySelector('.mascot-nudge')).toBeNull();
  });

  it('"Ver mis tareas" la cierra y lleva a las tareas', () => {
    const onTasks = vi.fn();
    showStreakNudge(mascot, { message: STREAK_NUDGES[0], onTasks });
    mascot.querySelector('.mascot-nudge button').click();
    expect(onTasks).toHaveBeenCalledOnce();
    expect(mascot.querySelector('.mascot-nudge')).toBeNull();
  });

  it('no apila dos burbujas', () => {
    showStreakNudge(mascot, { message: STREAK_NUDGES[0], onTasks() {} });
    showStreakNudge(mascot, { message: STREAK_NUDGES[1], onTasks() {} });
    expect(mascot.querySelectorAll('.mascot-nudge')).toHaveLength(1);
  });
});

describe('Topitín responde al tocarlo', () => {
  it('dice una frase corta que rota con cada toque', () => {
    expect(getMascotFeedbackMessage('tap', 1)).toBe('¡Hola! Aquí sigo contigo.');
    expect(getMascotFeedbackMessage('tap', 2)).toBe('¡Vamos por esa venta!');
    expect(getMascotFeedbackMessage('tap', 3)).toBe('Cada paso cuenta.');
    expect(getMascotFeedbackMessage('tap', 4)).toBe('¡Hola! Aquí sigo contigo.');
  });
});
