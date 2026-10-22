// @vitest-environment jsdom
// Spec de la pantalla de bienvenida (fase Red). Define la estructura esperada de src/welcome.js
// antes de implementarla. La animación GSAP se prueba aparte; aquí solo estado y DOM.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WELCOME_STAGES, createWelcome, getWelcomeTasks, shouldShowWelcome, welcomeDayKey } from '../src/welcome.js';

const clients = [
  {
    id: 'c1', name: 'Ferretería Norte',
    tasks: [
      { id: 't1', title: 'Preparar una visita', completed: true },
      { id: 't2', title: 'Contactar al cliente', completed: false },
    ],
  },
  {
    id: 'c2', name: 'Constructora Caribe',
    tasks: [{ id: 't3', title: 'Revisar una cotización', completed: false }],
  },
];

const visible = node => node.dataset.visible === 'true' && !node.hidden && node.getAttribute('aria-hidden') !== 'true';

describe('getWelcomeTasks', () => {
  it('devuelve solo las tareas pendientes, con el nombre de su cliente', () => {
    expect(getWelcomeTasks(clients)).toEqual([
      { id: 't2', title: 'Contactar al cliente', clientName: 'Ferretería Norte' },
      { id: 't3', title: 'Revisar una cotización', clientName: 'Constructora Caribe' },
    ]);
  });

  it('devuelve una lista vacía sin clientes ni tareas', () => {
    expect(getWelcomeTasks([])).toEqual([]);
    expect(getWelcomeTasks([{ id: 'c3', name: 'Sin tareas', tasks: [] }])).toEqual([]);
  });
});

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

describe('createWelcome', () => {
  let container, welcome, onClose;

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    container = document.querySelector('#root');
    onClose = vi.fn();
    welcome = createWelcome(container, { name: 'Ana', tasks: getWelcomeTasks(clients), mascotSrc: '/mascot/pinguino-feliz.png', onClose });
  });

  describe('pantalla inmersiva', () => {
    it('es un diálogo modal etiquetado por el mensaje', () => {
      expect(welcome.element.getAttribute('role')).toBe('dialog');
      expect(welcome.element.getAttribute('aria-modal')).toBe('true');
      const message = container.querySelector('[data-testid="welcome-message"]');
      expect(welcome.element.getAttribute('aria-labelledby')).toBe(message.id);
    });

    it('cada palabra se divide en letras animables que forman la palabra', () => {
      const words = [...container.querySelectorAll('.welcome-word')];
      words.forEach(word => {
        const chars = [...word.querySelectorAll('.welcome-char')];
        expect(chars.length).toBe([...word.textContent].length);
        expect(chars.map(char => char.textContent).join('')).toBe(word.textContent);
      });
    });

    it('la mascota usa la imagen indicada (Topitín saludando)', () => {
      const image = container.querySelector('[data-testid="welcome-mascot"] img');
      expect(image.getAttribute('src')).toBe('/mascot/pinguino-feliz.png');
    });
  });

  describe('cierre', () => {
    const closeButton = () => container.querySelector('[data-testid="welcome-close"]');

    it('tiene el botón "Ir a mi tablero", visible solo al terminar la secuencia', () => {
      expect(closeButton().textContent).toBe('Ir a mi tablero');
      expect(visible(closeButton())).toBe(false);
      welcome.setStage('tasks');
      expect(visible(closeButton())).toBe(false);
      welcome.setStage('done');
      expect(visible(closeButton())).toBe(true);
    });

    it('el botón llama a onClose una sola vez', () => {
      welcome.setStage('done');
      closeButton().click();
      closeButton().click();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Esc también cierra, y deja de escucharse después de cerrar', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('texto inicial', () => {
    it('renderiza el mensaje de bienvenida con el nombre del asesor', () => {
      const message = container.querySelector('[data-testid="welcome-message"]');
      expect(message).not.toBeNull();
      expect(message.tagName).toBe('H1');
      expect(message.getAttribute('aria-label')).toBe('¡Hola, Ana! Estas son tus tareas de hoy.');
    });

    it('divide el mensaje en palabras animables que juntas forman el texto completo', () => {
      const words = [...container.querySelectorAll('[data-testid="welcome-message"] .welcome-word')];
      expect(words.length).toBe(8);
      expect(words.map(word => word.textContent).join(' ')).toBe('¡Hola, Ana! Estas son tus tareas de hoy.');
      words.forEach(word => expect(word.getAttribute('aria-hidden')).toBe('true'));
    });
  });

  describe('secuencia: visibilidad según el estado', () => {
    it('define las etapas en orden', () => {
      expect(WELCOME_STAGES).toEqual(['intro', 'mascot', 'tasks', 'done']);
    });

    it('arranca en "intro": mascota y panel existen en el DOM pero están ocultos', () => {
      const mascot = container.querySelector('[data-testid="welcome-mascot"]');
      const panel = container.querySelector('[data-testid="welcome-tasks"]');
      expect(welcome.stage).toBe('intro');
      expect(welcome.element.dataset.stage).toBe('intro');
      expect(mascot).not.toBeNull();
      expect(panel).not.toBeNull();
      expect(visible(mascot)).toBe(false);
      expect(visible(panel)).toBe(false);
    });

    it('en "mascot" muestra la mascota y mantiene oculto el panel', () => {
      welcome.setStage('mascot');
      expect(welcome.element.dataset.stage).toBe('mascot');
      expect(visible(container.querySelector('[data-testid="welcome-mascot"]'))).toBe(true);
      expect(visible(container.querySelector('[data-testid="welcome-tasks"]'))).toBe(false);
    });

    it('en "tasks" y "done" muestra la mascota y el panel', () => {
      for (const stage of ['tasks', 'done']) {
        welcome.setStage(stage);
        expect(visible(container.querySelector('[data-testid="welcome-mascot"]'))).toBe(true);
        expect(visible(container.querySelector('[data-testid="welcome-tasks"]'))).toBe(true);
      }
    });

    it('rechaza una etapa desconocida sin cambiar el estado', () => {
      expect(() => welcome.setStage('otra')).toThrow();
      expect(welcome.stage).toBe('intro');
    });

    it('sin animación (movimiento reducido o tests) play() termina en "done"', async () => {
      await welcome.play({ animate: false });
      expect(welcome.stage).toBe('done');
      expect(visible(container.querySelector('[data-testid="welcome-tasks"]'))).toBe(true);
    });

    it('la mascota tiene texto alternativo de bienvenida', () => {
      // La etiqueta accesible vive en el contenedor; la imagen interna es decorativa.
      const mascot = container.querySelector('[data-testid="welcome-mascot"]');
      expect(mascot.querySelector('[role="img"]').getAttribute('aria-label')).toBe('Mascota dando la bienvenida');
    });
  });

  describe('panel de tareas del día', () => {
    it('tiene el título "Tareas del día" y una fila por tarea pendiente', () => {
      const panel = container.querySelector('[data-testid="welcome-tasks"]');
      expect(panel.querySelector('h2').textContent).toBe('Tareas del día');
      const items = [...panel.querySelectorAll('[data-testid="welcome-task"]')];
      expect(items).toHaveLength(2);
      expect(items[0].dataset.taskId).toBe('t2');
      expect(items[0].textContent).toContain('Contactar al cliente');
      expect(items[0].textContent).toContain('Ferretería Norte');
      expect(items[1].textContent).toContain('Revisar una cotización');
      expect(items[1].textContent).toContain('Constructora Caribe');
    });

    it('sin tareas pendientes muestra un aviso en lugar de inventar tareas', () => {
      document.body.innerHTML = '<div id="root"></div>';
      const empty = createWelcome(document.querySelector('#root'), { name: 'Ana', tasks: [] });
      const panel = empty.element.querySelector('[data-testid="welcome-tasks"]');
      expect(panel.querySelectorAll('[data-testid="welcome-task"]')).toHaveLength(0);
      expect(panel.textContent).toContain('No tienes tareas pendientes hoy.');
    });

    it('trata los textos de las tareas como texto, no como HTML', () => {
      document.body.innerHTML = '<div id="root"></div>';
      const unsafe = createWelcome(document.querySelector('#root'), {
        name: 'Ana', tasks: [{ id: 'x', title: '<img src=x onerror=alert(1)>', clientName: 'Cliente' }],
      });
      expect(unsafe.element.querySelector('[data-testid="welcome-tasks"] img')).toBeNull();
      expect(unsafe.element.textContent).toContain('<img src=x onerror=alert(1)>');
    });
  });
});
