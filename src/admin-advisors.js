import { advisorIcon } from './advisor-icons.js';
import { createProfileAvatar } from './profile-view.js';

// Semáforo del PRD sobre la meta mensual: ≥100 % cumple · 80–99 % en riesgo · <80 % crítico.
export function getAdvisorStatus(tons, goal) {
  const percentage = goal ? Math.round(tons / goal * 100) : 0;
  if (percentage >= 100) return { percentage, state: 'ok', label: 'Cumple' };
  if (percentage >= 80) return { percentage, state: 'risk', label: 'En riesgo' };
  return { percentage, state: 'critical', label: 'Crítico' };
}

const STATUS_ICONS = { ok: 'check', risk: 'alert', critical: 'alert' };

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function action(label, handler) {
  const node = element('button', 'danger-button', label);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
}

export function createAdvisorCard(advisor, { tons, sales, goal, clients, avatarUrl = '' }, actions) {
  const status = getAdvisorStatus(tons, goal);
  const card = element('article', 'advisor-card');
  card.dataset.state = status.state;

  const head = element('div', 'advisor-card-head');
  const copy = element('div', 'advisor-card-copy');
  copy.append(element('h3', '', advisor.full_name), element('p', 'advisor-email', advisor.email || 'Correo no disponible'));
  const badge = element('span', 'advisor-status');
  badge.dataset.state = status.state;
  const glyph = element('i', 'advisor-status-icon');
  glyph.setAttribute('aria-hidden', 'true');
  glyph.innerHTML = advisorIcon(STATUS_ICONS[status.state]);
  badge.append(glyph, document.createTextNode(status.label));
  head.append(createProfileAvatar({ ...advisor, avatar_url: avatarUrl }), copy, badge);

  const goalRow = element('div', 'advisor-card-progress');
  const bar = element('div', 'advisor-card-bar');
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', `Meta mensual de ${advisor.full_name}`);
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.setAttribute('aria-valuenow', String(Math.min(100, status.percentage)));
  const fill = element('span');
  fill.style.width = `${Math.min(100, status.percentage)}%`;
  bar.append(fill);
  const stats = element('div', 'advisor-card-stats');
  stats.append(
    element('span', 'advisor-card-goal', `${tons.toLocaleString('es-CO')} de ${goal} t · ${status.percentage} %`),
    element('span', 'advisor-card-sales', `${sales} ${sales === 1 ? 'venta' : 'ventas'}`),
  );
  goalRow.append(bar, stats);
  card.append(head, goalRow);

  const pendingTasks = clients.flatMap(client => client.tasks).filter(task => !task.completed).length;
  if (!clients.length) {
    card.append(element('p', 'empty-inline', 'Aún no tiene clientes.'));
  } else {
    const details = element('details', 'advisor-clients');
    details.append(element('summary', '', `Ver clientes (${clients.length}) · ${pendingTasks} ${pendingTasks === 1 ? 'tarea pendiente' : 'tareas pendientes'}`));
    const list = element('ul', 'pending-list');
    for (const client of clients) {
      const item = element('li');
      const pending = client.tasks.filter(task => !task.completed);
      const location = client.city && client.department ? ` · ${client.city}, ${client.department}` : '';
      item.append(element('strong', '', client.name), element('span', 'muted', `${location} · ${pending.length} pendientes`));
      const titles = element('ul', 'pending-titles');
      pending.forEach(task => titles.append(element('li', '', task.title)));
      item.append(titles);
      list.append(item);
    }
    details.append(list);
    card.append(details);
  }

  const manage = element('details', 'advisor-manage');
  manage.append(element('summary', '', 'Gestionar'));
  const buttons = element('div', 'advisor-manage-actions');
  if (clients.length) buttons.append(action('Borrar tareas', actions.resetTasks), action('Borrar clientes', actions.deleteClients));
  buttons.append(action('Borrar asesor', actions.deleteAdvisor));
  manage.append(buttons);
  card.append(manage);
  return card;
}
