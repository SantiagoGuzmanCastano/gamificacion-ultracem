// @vitest-environment jsdom
// Spec de la intro v2 (animaciones.md §14): inmersión sin panel de tareas, logo oficial en el vuelo,
// "¡Hola, {nombre}!", Topitín saluda y la intro se cierra sola (o se salta con clic, toque o Esc).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WELCOME_STAGES, createWelcome, shouldShowWelcome, welcomeDayKey } from '../src/welcome.js';

const visible = node => node.dataset.visible === 'true' && !node.hidden && node.getAttribute('aria-hidden') !== 'true';

describe('frecuencia: una vez al día', () => {
  it('genera la clave del día local como AAAA-MM-DD', () => {
    expect(welcomeDayKey(new Date(2026, 9, 22, 23, 59))).toBe('2026-10-22');
    expect(welcomeDayKey(new Date(2026, 0, 5, 8, 0))).toBe('2026-01-05');
  });

  it('se muestra si nunca se mostró o si se mostró otro día', () => {
    expect(shouldShowWelcome(null, '2026-10-22')).toBe(true);
    expect(shouldShowWelcome('2026-10-21', '2026-10-22')).toBe(true);
    expect(shouldShowWelcome('2026-10-22', '2026-10-22')).toBe(false);
  });
});

describe('createWelcome (intro v2)', () => {
  let container, welcome, onClose;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="root"></div>';
    container = document.querySelector('#root');
    onClose = vi.fn();
    welcome = createWelcome(container, { name: 'Ana', mascotSrc: '/mascot/pinguino-feliz.png', onClose });
  });

  afterEach(() => {
    welcome.close();
    vi.useRealTimers();
  });

  describe('estructura', () => {
    it('es un diálogo modal etiquetado por el mensaje', () => {
      const message = container.querySelector('[data-testid="welcome-message"]');
      expect(welcome.element.getAttribute('role')).toBe('dialog');
      expect(welcome.element.getAttribute('aria-modal')).toBe('true');
      expect(welcome.element.getAttribute('aria-labelledby')).toBe(message.id);
    });

    it('el mensaje es "¡Hola, {nombre}!", dividido en palabras y letras animables', () => {
      const message = container.querySelector('[data-testid="welcome-message"]');
      expect(message.tagName).toBe('H1');
      expect(message.getAttribute('aria-label')).toBe('¡Hola, Ana!');
      const words = [...message.querySelectorAll('.welcome-word')];
      expect(words.map(word => word.textContent)).toEqual(['¡Hola,', 'Ana!']);
      words.forEach(word => {
        expect(word.getAttribute('aria-hidden')).toBe('true');
        expect([...word.querySelectorAll('.welcome-char')].map(char => char.textContent).join('')).toBe(word.textContent);
      });
    });

    it('sin nombre dice solo "¡Hola!"', () => {
      const other = createWelcome(document.body, { onClose: () => {} });
      expect(other.element.querySelector('[data-testid="welcome-message"]').getAttribute('aria-label')).toBe('¡Hola!');
      other.close();
    });

    it('tres capas decorativas (fondo, medio, frente) y el frente lleva el logo oficial', () => {
      const layers = welcome.element.querySelector('[data-testid="welcome-layers"]');
      expect(welcome.element.firstElementChild).toBe(layers);
      expect(layers.getAttribute('aria-hidden')).toBe('true');
      expect([...layers.children].map(layer => layer.dataset.layer)).toEqual(['back', 'mid', 'front']);
      const logo = layers.querySelector('[data-layer="front"] img.welcome-logo');
      expect(logo.getAttribute('src')).toBe('/ultracem-logo.png');
      expect(logo.getAttribute('alt')).toBe('');
    });

    it('Topitín saluda: imagen indicada con texto alternativo en el contenedor', () => {
      const mascot = container.querySelector('[data-testid="welcome-mascot"]');
      expect(mascot.querySelector('img').getAttribute('src')).toBe('/mascot/pinguino-feliz.png');
      expect(mascot.querySelector('[role="img"]').getAttribute('aria-label')).toBe('Mascota dando la bienvenida');
      expect(mascot.textContent).toContain('¡Bienvenido!');
    });

    it('ya no hay panel de tareas ni botón para ir al tablero', () => {
      expect(container.querySelector('[data-testid="welcome-tasks"]')).toBeNull();
      expect(container.querySelector('[data-testid="welcome-task"]')).toBeNull();
      expect(container.querySelector('[data-testid="welcome-close"]')).toBeNull();
    });
  });

  describe('secuencia', () => {
    it('etapas en orden, sin "tasks"', () => {
      expect(WELCOME_STAGES).toEqual(['intro', 'mascot', 'done']);
    });

    it('arranca en "intro" con Topitín en el DOM pero oculto; en "mascot" se muestra', () => {
      const mascot = container.querySelector('[data-testid="welcome-mascot"]');
      expect(welcome.stage).toBe('intro');
      expect(visible(mascot)).toBe(false);
      welcome.setStage('mascot');
      expect(visible(mascot)).toBe(true);
    });

    it('rechaza una etapa desconocida', () => {
      expect(() => welcome.setStage('tasks')).toThrow();
      expect(welcome.stage).toBe('intro');
    });
  });

  describe('cierre automático y saltar', () => {
    it('al terminar espera 1,5 s y se cierra sola, una sola vez', async () => {
      await welcome.play({ animate: false });
      expect(welcome.stage).toBe('done');
      vi.advanceTimersByTime(1499);
      expect(onClose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(5000);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('un clic en cualquier parte la salta, y luego no se cierra otra vez sola', async () => {
      welcome.element.click();
      expect(onClose).toHaveBeenCalledTimes(1);
      await welcome.play({ animate: false });
      vi.advanceTimersByTime(5000);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Esc la salta; otras teclas no', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(onClose).not.toHaveBeenCalled();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('avisa a lectores de pantalla cómo saltarla', () => {
      expect(welcome.element.querySelector('.welcome-skip-hint').textContent).toBe('Toca o pulsa Esc para continuar');
    });
  });
});
