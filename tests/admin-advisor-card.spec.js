// @vitest-environment jsdom
// Spec de las tarjetas de asesor del administrador (fase Red).
// Semáforo del PRD sobre la meta mensual: ≥100 % cumple · 80–99 % en riesgo · <80 % crítico.
import { describe, expect, it, vi } from 'vitest';
import { createAdvisorCard, getAdvisorStatus } from '../src/admin-advisors.js';

const advisor = { user_id: 'a1', full_name: 'Asesor Demo', email: 'demo@demo.test' };
const clients = [
  { id: 'c1', name: 'Ferretería Norte', city: 'Barranquilla', department: 'Atlántico', tasks: [{ title: 'Revisar una cotización', completed: false }, { title: 'Preparar una visita', completed: true }] },
  { id: 'c2', name: 'Constructora Caribe', city: 'Cartagena de Indias', department: 'Bolívar', tasks: [{ title: 'Contactar al cliente', completed: false }] },
];
const handlers = () => ({ resetTasks: vi.fn(), deleteClients: vi.fn(), deleteAdvisor: vi.fn() });

describe('semáforo del asesor', () => {
  it('usa los umbrales del PRD', () => {
    expect(getAdvisorStatus(100, 100)).toEqual({ percentage: 100, state: 'ok', label: 'Cumple' });
    expect(getAdvisorStatus(85, 100)).toEqual({ percentage: 85, state: 'risk', label: 'En riesgo' });
    expect(getAdvisorStatus(80, 100).state).toBe('risk');
    expect(getAdvisorStatus(79, 100)).toEqual({ percentage: 79, state: 'critical', label: 'Crítico' });
    expect(getAdvisorStatus(130, 100).percentage).toBe(130);
  });
});

describe('tarjeta de asesor', () => {
  const render = (overrides = {}) => createAdvisorCard(advisor, { tons: 15, sales: 1, goal: 100, clients, ...overrides }, handlers());

  it('muestra nombre, correo, ventas y avance hacia la meta', () => {
    const card = render();
    expect(card.querySelector('h3').textContent).toBe('Asesor Demo');
    expect(card.textContent).toContain('demo@demo.test');
    expect(card.textContent).toContain('1 venta');
    expect(card.querySelector('.advisor-card-goal').textContent).toBe('15 de 100 t · 15 %');
    const bar = card.querySelector('[role="progressbar"]');
    expect(bar.getAttribute('aria-valuenow')).toBe('15');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('el estado lleva ícono y texto, no solo color', () => {
    const status = render().querySelector('.advisor-status');
    expect(status.dataset.state).toBe('critical');
    expect(status.querySelector('svg')).not.toBeNull();
    expect(status.textContent).toBe('Crítico');
  });

  it('la barra no se sale del 100 % aunque supere la meta', () => {
    const card = render({ tons: 130 });
    expect(card.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('100');
    expect(card.querySelector('.advisor-card-goal').textContent).toBe('130 de 100 t · 130 %');
  });

  it('los borrados quedan dentro de "Gestionar"', () => {
    const card = render();
    const manage = card.querySelector('details.advisor-manage');
    expect(manage.querySelector('summary').textContent).toBe('Gestionar');
    expect([...manage.querySelectorAll('button')].map(button => button.textContent)).toEqual(['Borrar tareas', 'Borrar clientes', 'Borrar asesor']);
    expect([...card.querySelectorAll('button')].every(button => manage.contains(button))).toBe(true);
  });

  it('sin clientes solo ofrece borrar el asesor', () => {
    const card = render({ clients: [] });
    expect([...card.querySelectorAll('.advisor-manage button')].map(button => button.textContent)).toEqual(['Borrar asesor']);
    expect(card.textContent).toContain('Aún no tiene clientes.');
  });

  it('los botones llaman a su acción', () => {
    const actions = handlers();
    const card = createAdvisorCard(advisor, { tons: 15, sales: 1, goal: 100, clients }, actions);
    const [reset, removeClients, removeAdvisor] = card.querySelectorAll('.advisor-manage button');
    reset.click(); removeClients.click(); removeAdvisor.click();
    expect(actions.resetTasks).toHaveBeenCalledOnce();
    expect(actions.deleteClients).toHaveBeenCalledOnce();
    expect(actions.deleteAdvisor).toHaveBeenCalledOnce();
  });

  it('los pendientes por cliente quedan plegados en "Ver clientes"', () => {
    const details = render().querySelector('details.advisor-clients');
    expect(details.querySelector('summary').textContent).toBe('Ver clientes (2) · 2 tareas pendientes');
    expect(details.textContent).toContain('Ferretería Norte');
    expect(details.textContent).toContain('Revisar una cotización');
    expect(details.textContent).not.toContain('Preparar una visita');
  });
});
