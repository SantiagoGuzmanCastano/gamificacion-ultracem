import './style.css';
import { createClient, completeTask, getProgress } from './game.js';
import { loadState, saveState, resetState } from './storage.js';
import { mascotImages, mascotLabels } from './mascot.js';

const loaded = loadState();
let state = loaded.state;
let selectedId = state.clients[0]?.id ?? null;
let role = 'admin';
let storageMessage = loaded.message;

document.querySelector('#app').innerHTML = `
  <header class="topbar">
    <span class="app-name">Gamificación <span class="demo-badge">Demo</span></span>
    <button class="text-button" id="reset" type="button">Reiniciar demo</button>
  </header>
  <main>
    <div class="page-intro">
      <div><h1>Pequeñas acciones.<br>Progreso visible.</h1>
      <p>Un espacio para practicar el seguimiento comercial,<br class="desktop-break"> una tarea a la vez.</p></div>
      <div class="demo-note"><span class="status-dot" aria-hidden="true"></span>Datos de demostración<br><span>Cumplimiento simulado</span></div>
    </div>
    <nav class="role-nav" aria-label="Vista de la demo">
      <button id="admin-tab" type="button" aria-pressed="true">Administrador</button>
      <button id="client-tab" type="button" aria-pressed="false">Cliente</button>
      <span>Cambia de vista para simular cada rol.</span>
    </nav>
    <p id="storage-notice" class="notice" role="status" hidden></p>
    <p id="announcement" class="sr-only" role="status" aria-live="polite"></p>
    <div id="workspace"></div>
    <footer>Esta demo simula roles y acciones comerciales. Completar una tarea no acredita una venta.<br>Los datos se guardan únicamente en este navegador.</footer>
  </main>`;

const workspace = document.querySelector('#workspace');
const announce = message => { document.querySelector('#announcement').textContent = message; };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, className, action) {
  const node = element('button', className, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

function selectClient(id) {
  selectedId = id;
  render();
}

function adminSidebar() {
  const aside = element('aside', 'sidebar');
  aside.append(element('h2', '', 'Crear cliente'), element('p', 'muted', 'Usa un nombre ficticio para comenzar.'));
  const form = element('form', 'create-form');
  const label = element('label', '', 'Nombre del participante');
  label.htmlFor = 'client-name';
  const input = element('input');
  input.id = 'client-name';
  input.name = 'name';
  input.placeholder = 'Ej. Ana';
  input.required = true;
  input.autocomplete = 'off';
  input.setAttribute('aria-describedby', 'name-error');
  const error = element('p', 'form-error');
  error.id = 'name-error';
  error.setAttribute('role', 'alert');
  const submit = element('button', 'primary', 'Crear cliente');
  submit.type = 'submit';
  form.append(label, input, error, submit);
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const client = createClient(input.value);
      state.clients.push(client);
      selectedId = client.id;
      storageMessage = saveState(state);
      render();
      document.querySelector('#client-name').focus();
      announce(`${client.name}: cliente creado con cuatro tareas pendientes.`);
    } catch (cause) {
      error.textContent = cause.message;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
  });
  aside.append(form);
  const listHeader = element('div', 'list-header');
  listHeader.append(element('h2', '', 'Clientes'), element('span', 'count', String(state.clients.length)));
  aside.append(listHeader);
  if (!state.clients.length) aside.append(element('p', 'muted', 'Aquí aparecerán los participantes que crees.'));
  const list = element('ul', 'client-list');
  for (const client of state.clients) {
    const progress = getProgress(client.tasks);
    const item = element('li');
    const control = button('', `client-option${client.id === selectedId ? ' selected' : ''}`, () => {
      selectClient(client.id);
      document.querySelector(`[data-client-id="${CSS.escape(client.id)}"]`)?.focus();
    });
    control.dataset.clientId = client.id;
    control.setAttribute('aria-pressed', String(client.id === selectedId));
    control.append(element('span', 'client-name', client.name), element('span', 'client-count', `${progress.completed}/${progress.total} tareas`));
    item.append(control);
    list.append(item);
  }
  aside.append(list);
  return aside;
}

function emptyView() {
  const empty = element('section', 'empty-state');
  empty.append(element('h2', '', 'Todo empieza con un cliente.'), element('p', 'muted', role === 'admin'
    ? 'Crea un participante. Le asignaremos cuatro tareas para explorar el recorrido.'
    : 'Crea primero un participante desde la vista Administrador.'));
  if (role === 'client') empty.append(button('Ir a Administrador', 'primary', () => changeRole('admin')));
  else empty.append(element('p', 'empty-hint', 'Crear → Asignar → Completar → Ver el progreso'));
  return empty;
}

function clientSelector() {
  const wrapper = element('div', 'client-selector');
  const label = element('label', '', 'Participante');
  label.htmlFor = 'client-select';
  const select = element('select');
  select.id = 'client-select';
  for (const client of state.clients) {
    const option = element('option', '', client.name);
    option.value = client.id;
    option.selected = client.id === selectedId;
    select.append(option);
  }
  select.addEventListener('change', () => {
    selectClient(select.value);
    document.querySelector('#client-select').focus();
  });
  wrapper.append(label, select);
  return wrapper;
}

function progressView(client) {
  const progress = getProgress(client.tasks);
  const section = element('section', 'progress-section');
  section.setAttribute('aria-label', 'Progreso del participante');
  const details = element('div', 'progress-details');
  details.append(element('h2', 'participant-name', client.name), element('p', 'muted', role === 'admin'
    ? 'Consulta sus tareas y acompaña su avance.' : 'Cada acción completada hace avanzar tu recorrido.'));
  const line = element('div', 'progress-line');
  line.append(element('span', '', `${progress.completed} de ${progress.total} tareas completadas`), element('strong', '', `${progress.rounded} %`));
  const bar = element('progress');
  bar.max = 100;
  bar.value = progress.percentage;
  bar.setAttribute('aria-label', 'Porcentaje de tareas completadas');
  bar.textContent = `${progress.rounded} %`;
  details.append(line, bar, element('p', 'progress-caption', progress.percentage === 100
    ? 'Recorrido completado. Todas tus acciones están listas.' : 'Cuatro tareas. Un paso a la vez.'));
  const mascot = element('div', 'mascot');
  const placeholder = element('div', 'mascot-placeholder', 'Mascota pendiente');
  const path = mascotImages[progress.mascot];
  if (path) {
    const img = element('img', 'mascot-image');
    img.alt = `Mascota: ${mascotLabels[progress.mascot]}`;
    img.addEventListener('error', () => img.replaceWith(placeholder), { once: true });
    img.src = path;
    mascot.append(img);
  } else mascot.append(placeholder);
  const label = element('p', 'mascot-state');
  label.append(element('span', '', 'Estado actual'), element('strong', '', mascotLabels[progress.mascot]));
  mascot.dataset.state = progress.mascot;
  mascot.append(label);
  section.append(details, mascot);
  return section;
}

function tasksView(client) {
  const section = element('section', 'tasks-section');
  const headingRow = element('div', 'tasks-header');
  const heading = element('h2', '', role === 'admin' ? 'Tareas asignadas' : 'Tus tareas');
  heading.id = 'tasks-heading';
  heading.tabIndex = -1;
  headingRow.append(heading, element('span', 'muted', 'Cumplimiento simulado'));
  section.append(headingRow);
  const list = element('ol', 'task-list');
  for (const task of client.tasks) {
    const item = element('li', `task${task.completed ? ' is-complete' : ''}`);
    const content = element('div', 'task-content');
    content.append(element('h3', '', task.title), element('p', 'task-description', task.description));
    const reason = element('p', 'task-reason');
    reason.append(element('span', '', 'Motivo: '), document.createTextNode(task.reason));
    content.append(reason);
    const actions = element('div', 'task-actions');
    actions.append(element('span', `task-status${task.completed ? ' completed' : ''}`, task.completed ? 'Completada' : 'Pendiente'));
    if (role === 'client' && !task.completed) {
      const complete = button('Completar tarea', 'secondary', () => {
        if (!completeTask(client, task.id)) return;
        storageMessage = saveState(state);
        render();
        document.querySelector('#tasks-heading').focus();
        announce(`Tarea completada. ${getProgress(client.tasks).completed} de 4 tareas listas.`);
      });
      complete.setAttribute('aria-label', `Completar tarea: ${task.title}`);
      actions.append(complete);
    }
    item.append(content, actions);
    list.append(item);
  }
  section.append(list);
  if (role === 'admin') section.append(element('p', 'admin-hint', 'Para simular una acción, cambia a la vista Cliente y completa una tarea.'));
  return section;
}

function changeRole(nextRole) {
  role = nextRole;
  render();
}

function render() {
  document.querySelector('#admin-tab').setAttribute('aria-pressed', String(role === 'admin'));
  document.querySelector('#client-tab').setAttribute('aria-pressed', String(role === 'client'));
  const notice = document.querySelector('#storage-notice');
  notice.textContent = storageMessage;
  notice.hidden = !storageMessage;
  workspace.className = role === 'admin' ? 'workspace admin-layout' : 'workspace client-layout';
  workspace.replaceChildren();
  if (role === 'admin') workspace.append(adminSidebar());
  const client = state.clients.find(item => item.id === selectedId);
  if (!client) {
    workspace.append(emptyView());
    return;
  }
  const detail = element('div', 'detail');
  if (role === 'client') detail.append(clientSelector());
  detail.append(progressView(client), tasksView(client));
  workspace.append(detail);
}

document.querySelector('#admin-tab').addEventListener('click', () => changeRole('admin'));
document.querySelector('#client-tab').addEventListener('click', () => changeRole('client'));
document.querySelector('#reset').addEventListener('click', () => {
  if (!window.confirm('¿Reiniciar la demo? Se borrarán todos los clientes y tareas de esta aplicación en este navegador.')) return;
  storageMessage = resetState();
  state = { version: 1, clients: [] };
  selectedId = null;
  role = 'admin';
  render();
  announce('Demo reiniciada. Crea un cliente para comenzar.');
});

render();
