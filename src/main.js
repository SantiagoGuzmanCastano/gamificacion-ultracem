import './style.css';
import { createAdvisor, createCustomer, completeTask, getProgress, getAdvisorProgress } from './game.js';
import { loadState, saveState, resetState } from './storage.js';
import { mascotImages, mascotLabels } from './mascot.js';

const loaded = loadState();
let state = loaded.state;
let role = 'admin';
let advisorId = state.advisors[0]?.id ?? null;
let customerId = state.customers.find(customer => customer.advisorId === advisorId)?.id ?? null;
let storageMessage = loaded.message;

document.querySelector('#app').innerHTML = `
  <header class="topbar">
    <div class="brand">Gamificación <span class="demo-badge">Demo</span></div>
    <div class="top-actions"><button id="role-switch" class="switch-button" type="button"></button><button id="reset" class="text-button" type="button">Reiniciar demo</button></div>
  </header>
  <main><p id="storage-notice" class="notice" role="status" hidden></p><p id="announcement" class="sr-only" role="status" aria-live="polite"></p><div id="page"></div>
    <footer>Datos de demostración · Cumplimiento simulado. Completar una tarea no acredita una venta.<br>Las vistas simulan roles; los datos se guardan solo en este navegador.</footer>
  </main>`;

const page = document.querySelector('#page');
const announce = message => { document.querySelector('#announcement').textContent = message; };

function el(tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, className, action) {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

function field(labelText, id, input) {
  const wrap = el('div', 'field');
  const label = el('label', '', labelText);
  label.htmlFor = id;
  input.id = id;
  wrap.append(label, input);
  return wrap;
}

function formError() {
  const error = el('p', 'form-error');
  error.setAttribute('role', 'alert');
  return error;
}

function save() {
  storageMessage = saveState(state);
  render();
}

function intro(title, description, className) {
  const header = el('div', `page-intro ${className}`);
  const copy = el('div');
  copy.append(el('h1', '', title), el('p', '', description));
  header.append(copy, el('span', 'demo-note', 'Datos de demostración · Cumplimiento simulado'));
  return header;
}

function metric(label, value, note) {
  const item = el('div', 'metric');
  item.append(el('span', 'metric-label', label), el('strong', 'metric-value', String(value)), el('span', 'metric-note', note));
  return item;
}

function metrics(items) {
  const row = el('div', 'metrics');
  for (const item of items) row.append(metric(...item));
  return row;
}

function advisorForm() {
  const form = el('form', 'editor-form');
  const input = el('input');
  input.placeholder = 'Ej. Ana';
  input.autocomplete = 'off';
  input.required = true;
  const error = formError();
  const submit = el('button', 'primary', 'Crear asesor');
  submit.type = 'submit';
  form.append(el('h2', '', 'Nuevo asesor'), field('Nombre del asesor', 'advisor-name', input), error, submit);
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const advisor = createAdvisor(input.value);
      state.advisors.push(advisor);
      advisorId = advisor.id;
      customerId = null;
      save();
      document.querySelector('#advisor-name').focus();
      announce(`${advisor.name}: asesor creado.`);
    } catch (cause) {
      error.textContent = cause.message;
      input.focus();
    }
  });
  return form;
}

function customerForm() {
  const form = el('form', 'editor-form');
  const name = el('input');
  name.placeholder = 'Ej. Ferretería Norte';
  name.autocomplete = 'off';
  name.required = true;
  const type = el('select');
  for (const value of ['Ferretería', 'Constructora', 'Distribuidor', 'Otro']) {
    const option = el('option', '', value);
    option.value = value;
    type.append(option);
  }
  const advisor = el('select');
  for (const item of state.advisors) {
    const option = el('option', '', item.name);
    option.value = item.id;
    option.selected = item.id === advisorId;
    advisor.append(option);
  }
  const error = formError();
  const submit = el('button', 'primary', 'Crear cliente y asignar tareas');
  submit.type = 'submit';
  form.append(el('h2', '', 'Nuevo cliente comercial'),
    field('Nombre del negocio', 'customer-name', name),
    field('Tipo de cliente', 'customer-type', type),
    field('Asesor responsable', 'customer-advisor', advisor), error, submit);
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const customer = createCustomer(name.value, type.value, advisor.value);
      state.customers.push(customer);
      advisorId = customer.advisorId;
      customerId = customer.id;
      save();
      document.querySelector('#customer-name').focus();
      announce(`${customer.name}: cliente creado y asignado con cuatro tareas.`);
    } catch (cause) {
      error.textContent = cause.message;
      name.focus();
    }
  });
  return form;
}

function pendingFor(advisor) {
  const customers = state.customers.filter(customer => customer.advisorId === advisor.id);
  const progress = getAdvisorProgress(state.customers, advisor.id);
  const section = el('article', 'advisor-row');
  const head = el('div', 'advisor-row-head');
  const copy = el('div');
  copy.append(el('h3', '', advisor.name), el('p', 'muted', `${customers.length} ${customers.length === 1 ? 'cliente' : 'clientes'} asignados`));
  head.append(copy, el('strong', 'pending-count', `${progress.total - progress.completed} pendientes`));
  section.append(head);
  if (!customers.length) {
    section.append(el('p', 'empty-inline', 'Aún no tiene clientes comerciales asignados.'));
    return section;
  }
  const list = el('ul', 'pending-list');
  for (const customer of customers) {
    const pending = customer.tasks.filter(task => !task.completed);
    const item = el('li');
    const name = el('strong', '', customer.name);
    item.append(name, el('span', 'muted', ` · ${customer.type} · ${pending.length} pendientes`));
    if (pending.length) {
      const tasks = el('ul', 'pending-titles');
      for (const task of pending) tasks.append(el('li', '', task.title));
      item.append(tasks);
    } else item.append(el('p', 'all-done', 'Todas las tareas completadas'));
    list.append(item);
  }
  section.append(list);
  return section;
}

function adminPage() {
  const fragment = document.createDocumentFragment();
  fragment.append(intro('Panorama comercial', 'Una vista del trabajo pendiente por asesor y por cliente comercial.', 'admin-intro'));
  const allTasks = state.customers.flatMap(customer => customer.tasks);
  const completed = allTasks.filter(task => task.completed).length;
  fragment.append(metrics([
    ['Asesores', state.advisors.length, 'participantes de la demo'],
    ['Clientes comerciales', state.customers.length, 'negocios asignados'],
    ['Tareas pendientes', allTasks.length - completed, 'acciones por completar'],
  ]));
  const layout = el('div', 'admin-columns');
  const overview = el('section', 'admin-overview');
  overview.append(el('h2', 'section-title', 'Pendientes por asesor'));
  if (!state.advisors.length) overview.append(el('div', 'empty-state', 'Crea un asesor para empezar a organizar clientes y tareas.'));
  for (const advisor of state.advisors) overview.append(pendingFor(advisor));
  const management = el('aside', 'admin-management');
  management.append(advisorForm());
  if (state.advisors.length) management.append(customerForm());
  else management.append(el('p', 'muted management-hint', 'Después podrás crear negocios y asignarlos a un asesor.'));
  layout.append(overview, management);
  fragment.append(layout);
  return fragment;
}

function advisorSelector() {
  const select = el('select');
  for (const advisor of state.advisors) {
    const option = el('option', '', advisor.name);
    option.value = advisor.id;
    option.selected = advisor.id === advisorId;
    select.append(option);
  }
  select.addEventListener('change', () => {
    advisorId = select.value;
    customerId = state.customers.find(customer => customer.advisorId === advisorId)?.id ?? null;
    render();
    document.querySelector('#advisor-select')?.focus();
  });
  return field('Asesor', 'advisor-select', select);
}

function customerList(customers) {
  const aside = el('aside', 'customer-rail');
  aside.append(el('h2', '', 'Mis clientes'), el('p', 'muted', 'Selecciona un negocio para ver sus tareas.'));
  const list = el('ul', 'customer-list');
  for (const customer of customers) {
    const item = el('li');
    const control = button('', `customer-option${customer.id === customerId ? ' selected' : ''}`, () => {
      customerId = customer.id;
      render();
      document.querySelector(`[data-customer-id="${CSS.escape(customer.id)}"]`)?.focus();
    });
    control.dataset.customerId = customer.id;
    control.setAttribute('aria-pressed', String(customer.id === customerId));
    const progress = getProgress(customer.tasks);
    control.append(el('strong', '', customer.name), el('span', 'muted', `${customer.type} · ${progress.total - progress.completed} pendientes`));
    item.append(control);
    list.append(item);
  }
  aside.append(list);
  return aside;
}

function progressView(customer) {
  const progress = getProgress(customer.tasks);
  const section = el('section', 'progress-section');
  section.setAttribute('aria-label', 'Progreso del cliente');
  const details = el('div', 'progress-details');
  details.append(el('p', 'customer-type', customer.type), el('h2', 'participant-name', customer.name),
    el('p', 'muted', 'Acciones comerciales de este cliente.'));
  const line = el('div', 'progress-line');
  line.append(el('span', '', `${progress.completed} de ${progress.total} tareas completadas`), el('strong', '', `${progress.rounded} %`));
  const bar = el('progress');
  bar.max = 100;
  bar.value = progress.percentage;
  bar.setAttribute('aria-label', 'Porcentaje de tareas completadas');
  details.append(line, bar);
  const mascot = el('div', 'mascot');
  const placeholder = el('div', 'mascot-placeholder', 'Mascota pendiente');
  const path = mascotImages[progress.mascot];
  if (path) {
    const img = el('img', 'mascot-image');
    img.alt = `Mascota: ${mascotLabels[progress.mascot]}`;
    img.addEventListener('error', () => img.replaceWith(placeholder), { once: true });
    img.src = path;
    mascot.append(img);
  } else mascot.append(placeholder);
  const label = el('p', 'mascot-state');
  label.append(el('span', '', 'Estado actual'), el('strong', '', mascotLabels[progress.mascot]));
  mascot.append(label);
  section.append(details, mascot);
  return section;
}

function tasksView(customer) {
  const section = el('section', 'tasks-section');
  const head = el('div', 'tasks-header');
  const heading = el('h2', 'section-title', 'Tareas de este cliente');
  heading.id = 'tasks-heading';
  heading.tabIndex = -1;
  head.append(heading, el('span', 'muted', 'Cumplimiento simulado'));
  section.append(head);
  const list = el('ol', 'task-list');
  for (const task of customer.tasks) {
    const item = el('li', 'task');
    const content = el('div', 'task-content');
    content.append(el('h3', '', task.title), el('p', 'task-description', task.description));
    const reason = el('p', 'task-reason');
    reason.append(el('strong', '', 'Motivo: '), document.createTextNode(task.reason));
    content.append(reason);
    const actions = el('div', 'task-actions');
    actions.append(el('span', `task-status${task.completed ? ' completed' : ''}`, task.completed ? 'Completada' : 'Pendiente'));
    if (!task.completed) {
      const complete = button('Completar tarea', 'secondary', () => {
        if (!completeTask(customer, task.id)) return;
        save();
        document.querySelector('#tasks-heading')?.focus();
        announce(`${customer.name}: ${getProgress(customer.tasks).completed} de 4 tareas completadas.`);
      });
      complete.setAttribute('aria-label', `Completar tarea: ${task.title}`);
      actions.append(complete);
    }
    item.append(content, actions);
    list.append(item);
  }
  section.append(list);
  return section;
}

function advisorPage() {
  const fragment = document.createDocumentFragment();
  fragment.append(intro('Mi cartera de clientes', 'Organiza el seguimiento de cada negocio, una acción a la vez.', 'advisor-intro'));
  if (!state.advisors.length) {
    const empty = el('section', 'empty-state');
    empty.append(el('h2', '', 'Todavía no hay asesores.'), el('p', 'muted', 'Crea un asesor desde el panel de Administrador para empezar.'),
      button('Ir a Administrador', 'primary', () => changeRole('admin')));
    fragment.append(empty);
    return fragment;
  }
  fragment.append(advisorSelector());
  const customers = state.customers.filter(customer => customer.advisorId === advisorId);
  const progress = getAdvisorProgress(state.customers, advisorId);
  fragment.append(metrics([
    ['Mis clientes', customers.length, 'negocios asignados'],
    ['Por completar', progress.total - progress.completed, 'tareas pendientes'],
    ['Completadas', progress.completed, 'acciones realizadas'],
  ]));
  if (!customers.length) {
    fragment.append(el('div', 'empty-state', 'Este asesor todavía no tiene clientes. El Administrador puede asignarle uno.'));
    return fragment;
  }
  const layout = el('div', 'advisor-columns');
  layout.append(customerList(customers));
  const selected = customers.find(customer => customer.id === customerId) ?? customers[0];
  customerId = selected.id;
  const detail = el('div', 'customer-detail');
  detail.append(progressView(selected), tasksView(selected));
  layout.append(detail);
  fragment.append(layout);
  return fragment;
}

function changeRole(nextRole) {
  role = nextRole;
  render();
  document.querySelector('#role-switch').focus();
}

function render() {
  const switcher = document.querySelector('#role-switch');
  switcher.textContent = role === 'admin' ? 'Cambiar a Asesor' : 'Cambiar a Administrador';
  const notice = document.querySelector('#storage-notice');
  notice.textContent = storageMessage;
  notice.hidden = !storageMessage;
  page.className = role === 'admin' ? 'admin-page' : 'advisor-page';
  page.replaceChildren(role === 'admin' ? adminPage() : advisorPage());
}

document.querySelector('#role-switch').addEventListener('click', () => changeRole(role === 'admin' ? 'advisor' : 'admin'));
document.querySelector('#reset').addEventListener('click', () => {
  if (!window.confirm('¿Reiniciar la demo? Se borrarán los asesores, clientes y tareas de esta aplicación.')) return;
  storageMessage = resetState();
  state = { version: 2, advisors: [], customers: [] };
  advisorId = null;
  customerId = null;
  role = 'admin';
  render();
  announce('Demo reiniciada. Crea un asesor para comenzar.');
});

render();
