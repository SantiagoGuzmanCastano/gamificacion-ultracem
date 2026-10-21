import './style.css';
import { createClient } from '@supabase/supabase-js';
import { getProgress, getXp, isTaskCompletionConfirmed, shouldShowEncouragement } from './game.js';
import { mascotImages, mascotLabels } from './mascot.js';

const db = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) : null;
const root = document.querySelector('#app');
let user = null, profile = null, advisors = [], clients = [], sales = [], ranking = [], selectedId = null, aiRecommendation = '', saleNotice = '';
let theme = localStorage.getItem('ultracem-theme') || 'light';
document.documentElement.dataset.theme = theme;
const taskOrder = ['Preparar una visita', 'Contactar al cliente', 'Revisar una cotización', 'Planear el siguiente paso'];

function el(tag, className = '', value = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = value;
  return node;
}
function button(label, className, handler) {
  const node = el('button', className, label);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
}
function input(type, placeholder) {
  const node = el('input');
  node.type = type;
  node.placeholder = placeholder;
  node.required = true;
  return node;
}
function field(label, control) {
  const wrap = el('label', 'field', label);
  wrap.append(control);
  return wrap;
}
function notice(text, error = false) {
  const node = document.querySelector('#notice');
  node.textContent = text;
  node.hidden = !text;
  node.classList.toggle('error-notice', error);
}
function celebrateCompletion() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = el('div', 'confetti-layer');
  layer.setAttribute('aria-hidden', 'true');
  const colors = ['#0876d1', '#19b889', '#ffc629', '#ff7a35', '#55c9f2'];
  for (let index = 0; index < 36; index++) {
    const piece = el('span', `confetti-piece${index % 3 === 0 ? ' round' : ''}`);
    piece.style.setProperty('--confetti-left', `${Math.random() * 100}%`);
    piece.style.setProperty('--confetti-drift', `${Math.round(Math.random() * 180 - 90)}px`);
    piece.style.setProperty('--confetti-rotation', `${Math.round(Math.random() * 900 - 450)}deg`);
    piece.style.setProperty('--confetti-duration', `${1.35 + Math.random() * 0.7}s`);
    piece.style.setProperty('--confetti-delay', `${Math.random() * 0.18}s`);
    piece.style.setProperty('--confetti-color', colors[index % colors.length]);
    layer.append(piece);
  }
  document.body.append(layer);
  window.setTimeout(() => layer.remove(), 2300);
}
function releaseMascotHeart(completedTasks) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const mascot = document.querySelector('.mascot');
  if (!mascot) return;
  const heart = el('span', 'mascot-heart', '♥');
  const stage = Math.min(4, Math.max(1, completedTasks));
  heart.style.setProperty('--heart-size', `${2.25 + stage * 0.2}rem`);
  heart.style.setProperty('--heart-duration', `${1.65 + stage * 0.16}s`);
  heart.style.setProperty('--heart-rise', `${120 + stage * 12}px`);
  heart.setAttribute('aria-hidden', 'true');
  mascot.append(heart);
  window.setTimeout(() => heart.remove(), 2500);
}
function releaseMascotMessage(completedTasks) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const mascot = document.querySelector('.mascot');
  if (!mascot) return;
  const messages = ['¡Tú puedes!', '¡Cada paso cuenta!', '¡Vas con todo!', '¡Buen trabajo!'];
  const message = el('span', 'mascot-message', messages[(completedTasks / 2 - 1) % messages.length]);
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  mascot.append(message);
  window.setTimeout(() => message.remove(), 2600);
}
function authError(cause) {
  if (cause.code === 'invalid_credentials') return 'Correo o contraseña incorrectos.';
  if (cause.code === 'email_not_confirmed') return 'Confirma tu correo antes de entrar.';
  if (cause.code === 'user_already_exists') return 'Ya existe una cuenta con este correo.';
  if (cause.code === 'over_email_send_rate_limit' || /rate limit exceeded/i.test(cause.message || '')) {
    return 'Supabase alcanzó el límite de correos de confirmación. Espera unos minutos y revisa si ya recibiste el correo antes de intentarlo de nuevo.';
  }
  return cause.message || 'No se pudo acceder.';
}
function shell() {
  root.className = profile && profile.role !== 'admin' ? 'advisor-shell' : '';
  root.innerHTML = '<header class="topbar"><div class="brand"><span class="brand-mark">U</span><span>Gamificación</span><span class="demo-badge">MVP</span></div><div class="top-actions" id="actions"></div></header><div class="app-layout"><aside class="app-sidebar" aria-label="Navegación decorativa"><div class="sidebar-caption">ULTRACEM</div><div class="sidebar-nav"><span class="sidebar-item active"><b>01</b> Resumen</span><span class="sidebar-item"><b>02</b> Clientes</span><span class="sidebar-item"><b>03</b> Progreso</span><span class="sidebar-item"><b>04</b> Ranking</span></div><div class="sidebar-bottom"><span class="sidebar-pulse"></span><span>Ruta comercial</span><small>Panel operativo</small></div></aside><main><p id="notice" class="notice" role="status" hidden></p><div id="page"></div><footer>Acciones comerciales de demostración. Completar una tarea no acredita una venta.</footer></main></div>';
  if (root.classList.contains('advisor-shell')) {
    const sidebar = root.querySelector('.app-sidebar');
    const brand = el('div', 'sidebar-brand');
    brand.innerHTML = '<span class="sidebar-brand-symbol" aria-hidden="true">U</span><span class="sidebar-brand-name">ULTRACEM</span>';
    const caption = sidebar.querySelector('.sidebar-caption');
    caption.textContent = 'GAMIFICACIÓN';
    caption.after(el('span', 'sidebar-mvp', 'MVP'));
    sidebar.prepend(brand);
    sidebar.append(el('p', 'sidebar-motto', 'CONSTRUYENDO UN MUNDO MÁS FUERTE'));
  }
  if (profile) {
    const actions = document.querySelector('#actions');
    actions.append(el('span', 'session-name', `${profile.full_name} · ${profile.role === 'admin' ? 'Administrador' : 'Asesor'}`));
    actions.append(button(theme === 'dark' ? '☀️ Claro' : '🌙 Oscuro', 'theme-button', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('ultracem-theme', theme);
      document.documentElement.dataset.theme = theme;
      shell();
      render();
    }));
    actions.append(button('Cerrar sesión', 'text-button', async () => {
      const result = await db.auth.signOut();
      if (result.error) { notice('No se pudo cerrar la sesión. Intenta de nuevo.', true); return; }
      user = profile = null; advisors = clients = sales = ranking = []; aiRecommendation = ''; saleNotice = '';
      render();
    }));
  }
}
function authPage(mode = 'login') {
  const page = document.querySelector('#page');
  page.className = 'auth-page';
  const form = el('form', 'editor-form auth-form');
  form.append(el('h1', '', mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta de asesor'));
  form.append(el('p', 'muted', mode === 'login' ? 'Entra con tu correo y contraseña.' : 'Regístrate para ver los clientes que te asignen.'));
  const name = input('text', 'Tu nombre');
  name.minLength = 2; name.maxLength = 80;
  if (mode === 'signup') form.append(field('Nombre completo', name));
  const email = input('email', 'correo@ejemplo.com');
  email.autocomplete = 'email';
  const password = input('password', 'Contraseña');
  password.minLength = 6;
  password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  form.append(field('Correo', email), field('Contraseña', password));
  const error = el('p', 'form-error');
  error.setAttribute('role', 'alert');
  const submit = el('button', 'primary', mode === 'login' ? 'Entrar' : 'Crear cuenta');
  submit.type = 'submit';
  form.append(error, submit);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    error.textContent = '';
    submit.disabled = true; submit.textContent = 'Cargando…';
    try {
      if (mode === 'signup') {
        const result = await db.auth.signUp({ email: email.value.trim(), password: password.value, options: { data: { full_name: name.value.trim() } } });
        if (result.error) throw result.error;
        if (!result.data.session) {
          authPage('login');
          notice('Cuenta creada. Confirma tu correo y luego inicia sesión.');
          return;
        }
      } else {
        const result = await db.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
        if (result.error) throw result.error;
      }
      await boot();
    } catch (cause) {
      error.textContent = authError(cause);
      submit.disabled = false;
      submit.textContent = mode === 'login' ? 'Entrar' : 'Crear cuenta';
    }
  });
  page.replaceChildren(form, button(mode === 'login' ? 'Crear cuenta de asesor' : 'Ya tengo cuenta', 'text-button auth-toggle', () => authPage(mode === 'login' ? 'signup' : 'login')));
}
async function loadData() {
  const own = await db.from('mvp_profiles').select('user_id,full_name,role').eq('user_id', user.id).single();
  if (own.error) throw own.error;
  profile = own.data;
  if (profile.role === 'admin') {
    const list = await db.rpc('get_mvp_advisors');
    if (list.error) throw list.error;
    advisors = (list.data ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name));
  } else advisors = [];
  const result = await db.from('mvp_clients').select('id,name,type,advisor_id,mvp_tasks(id,title,description,completed_at)').order('created_at', { ascending: false });
  if (result.error) throw result.error;
  clients = result.data.map(client => ({
    ...client,
    tasks: client.mvp_tasks
      .map(task => ({ ...task, completed: Boolean(task.completed_at) }))
      .sort((a, b) => {
        const aIndex = taskOrder.indexOf(a.title);
        const bIndex = taskOrder.indexOf(b.title);
        return (aIndex < 0 ? taskOrder.length : aIndex) - (bIndex < 0 ? taskOrder.length : bIndex);
      }),
  }));
  const salesResult = await db.from('mvp_sales').select('id,client_id,advisor_id,amount,completed_at');
  if (salesResult.error) throw salesResult.error;
  sales = salesResult.data ?? [];
  const rankingResult = await db.rpc('get_mvp_advisor_ranking');
  if (rankingResult.error) throw rankingResult.error;
  ranking = rankingResult.data ?? [];
  if (!clients.some(client => client.id === selectedId)) selectedId = clients[0]?.id ?? null;
}
async function boot() {
  shell(); notice('Cargando datos…');
  const result = await db.auth.getUser();
  user = result.data.user;
  if (!user) { profile = null; render(); return; }
  try { await loadData(); render(); }
  catch (cause) {
    shell();
    document.querySelector('#page').replaceChildren(el('p', 'empty-state', 'No se pudieron cargar los datos.'), button('Reintentar', 'primary', boot));
    notice(cause.message, true);
  }
}
function metrics(items, advisor = false) {
  const row = el('div', 'metrics');
  if (advisor) row.classList.add('advisor-metrics');
  const iconPaths = [
    '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20v-2a5.5 5.5 0 0 1 11 0v2M15 15a4.5 4.5 0 0 1 6.5 4v1"/>',
    '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M9 10h6M9 14h6M9 18h4"/>',
    '<circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/>',
    '<path d="M12 2 21 7v10l-9 5-9-5V7z"/><path d="M7.5 11h9M8 14h8"/>',
    '<path d="M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4M12 14v4M8 21h8M9 18h6"/>',
  ];
  for (const [index, [label, value, note]] of items.entries()) {
    const item = el('div', 'metric');
    if (advisor) {
      const icon = el('span', 'metric-icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPaths[index]}</svg>`;
      item.append(icon);
    }
    item.append(el('span', 'metric-label', label), el('strong', 'metric-value', String(value)), el('span', 'metric-note', note));
    row.append(item);
  }
  return row;
}
function rankingSection() {
  const section = el('section', 'ranking-section');
  section.append(el('h2', 'section-title', 'Ranking de asesores'), el('p', 'muted', 'Cada tarea completada suma 10 XP.'));
  if (!ranking.length) {
    section.append(el('p', 'empty-state', 'Aún no hay asesores con actividad registrada.'));
    return section;
  }
  const list = el('ol', 'ranking-list');
  for (const row of ranking) {
    const item = el('li', 'ranking-row' + (row.advisor_id === user?.id ? ' current' : ''));
    const identity = el('div', 'ranking-identity');
    identity.append(el('strong', '', `${row.position}. ${row.full_name}`), el('span', 'muted', `${row.completed_tasks} tareas completadas`));
    item.append(identity, el('strong', 'ranking-xp', `${row.xp} XP`));
    list.append(item);
  }
  section.append(list);
  return section;
}
function adminMetricsSection() {
  const totalAmount = sales.reduce((total, sale) => total + Number(sale.amount || 0), 0);
  const section = el('section', 'metrics-dashboard');
  section.append(el('h2', 'section-title', 'Métricas generales'), el('p', 'muted', 'Resultados simulados a partir de misiones completadas.'));
  section.append(metrics([['Misiones completadas', sales.length, 'ventas simuladas'], ['Valor acumulado', `$${totalAmount.toLocaleString('es-CO')}`, 'valor de prueba']]));
  const list = el('ul', 'metrics-breakdown');
  for (const advisor of advisors) {
    const advisorSales = sales.filter(sale => sale.advisor_id === advisor.user_id);
    const amount = advisorSales.reduce((total, sale) => total + Number(sale.amount || 0), 0);
    const item = el('li', 'metrics-breakdown-row');
    const details = el('div', 'metrics-advisor-details');
    details.append(el('strong', '', advisor.full_name), el('span', 'muted', `${advisorSales.length} ventas · $${amount.toLocaleString('es-CO')}`));
    for (const sale of advisorSales) {
      const client = clients.find(item => item.id === sale.client_id);
      details.append(el('span', 'metrics-sale-client', `${client?.name || 'Cliente eliminado'} · $${Number(sale.amount).toLocaleString('es-CO')}`));
    }
    item.append(details);
    list.append(item);
  }
  if (advisors.length) section.append(list);
  return section;
}
function intro(title, description, className) {
  const head = el('div', `page-intro ${className}`), copy = el('div');
  copy.append(el('h1', '', title), el('p', '', description)); head.append(copy);
  return head;
}
async function resetAdvisorTasks(advisor, clientCount) {
  if (!clientCount) return;
  const confirmed = window.confirm('¿Borrar todas las tareas de ' + advisor.full_name + '? Se eliminarán también las completadas y esta acción no se puede deshacer.');
  if (!confirmed) return;
  const result = await db.rpc('reset_mvp_advisor_tasks', { target_advisor: advisor.user_id });
  if (result.error) {
    notice(result.error.message, true);
    return;
  }
  await refresh('Tareas de ' + advisor.full_name + ' eliminadas.');
}
async function deleteAdvisorClients(advisor, clientCount) {
  if (!clientCount) return;
  const confirmed = window.confirm('¿Borrar los ' + clientCount + ' clientes de ' + advisor.full_name + '? También se eliminarán sus tareas y esta acción no se puede deshacer.');
  if (!confirmed) return;
  const result = await db.rpc('delete_mvp_advisor_clients', { target_advisor: advisor.user_id });
  if (result.error) {
    notice(result.error.message, true);
    return;
  }
  await refresh('Clientes de ' + advisor.full_name + ' eliminados.');
}
async function deleteAdvisor(advisor) {
  const confirmed = window.confirm('¿Borrar la cuenta de ' + advisor.full_name + '? Se eliminarán también sus clientes, tareas y puntos del ranking. Esta acción no se puede deshacer.');
  if (!confirmed) return;
  const result = await db.rpc('delete_mvp_advisor', { target_advisor: advisor.user_id });
  if (result.error) {
    notice(result.error.message, true);
    return;
  }
  await refresh('Asesor ' + advisor.full_name + ' eliminado.');
}
async function clearCompletedTasks(client) {
  const confirmed = window.confirm('¿Limpiar las tareas completadas de ' + client.name + '? La venta y las métricas se conservarán.');
  if (!confirmed) return;
  const result = await db.rpc('clear_mvp_completed_tasks', { target_client: client.id });
  if (result.error) {
    notice(result.error.message, true);
    return;
  }
  await refresh('Tareas completadas de ' + client.name + ' limpiadas. Las métricas se conservaron.');
}
async function requestRecommendation(client, control) {
  control.disabled = true;
  control.textContent = 'Analizando…';
  aiRecommendation = '';
  const progress = getProgress(client.tasks);
  const result = await db.functions.invoke('recommend-client', {
    body: {
      name: client.name,
      type: client.type,
      completed_tasks: progress.completed,
      total_tasks: progress.total,
      pending_tasks: progress.total - progress.completed,
      progress: progress.rounded,
      tasks: client.tasks.filter(task => !task.completed).map(task => ({ title: task.title, description: task.description })),
    },
  });
  if (result.error || result.data?.error) {
    notice(result.data?.error || result.error.message, true);
  } else {
    aiRecommendation = result.data.recommendation;
    render();
  }
  control.disabled = false;
  control.textContent = 'Sugerir siguiente acción';
}
function adminPage(page) {
  const tasks = clients.flatMap(client => client.tasks);
  page.className = 'admin-page';
  page.append(intro('Panorama comercial', 'Clientes y tareas pendientes por asesor.', 'admin-intro'));
  const totalXp = ranking.reduce((total, row) => total + Number(row.xp || 0), 0);
  page.append(metrics([['Asesores', advisors.length, 'cuentas registradas'], ['Clientes comerciales', clients.length, 'negocios asignados'], ['Tareas pendientes', tasks.filter(task => !task.completed).length, 'acciones por completar'], ['XP acumulado', totalXp, 'de todos los asesores']]));
  page.append(rankingSection());
  page.append(adminMetricsSection());
  const layout = el('div', 'admin-columns'), overview = el('section', 'admin-overview');
  overview.append(el('h2', 'section-title', 'Pendientes por asesor'));
  if (!advisors.length) overview.append(el('p', 'empty-state', 'Todavía no hay asesores. Pídeles que creen una cuenta.'));
  for (const advisor of advisors) {
    const assigned = clients.filter(client => client.advisor_id === advisor.user_id);
    const pending = assigned.flatMap(client => client.tasks).filter(task => !task.completed).length;
    const section = el('article', 'advisor-row'), head = el('div', 'advisor-row-head'), copy = el('div');
    copy.append(el('h3', '', advisor.full_name), el('p', 'advisor-email', advisor.email || 'Correo no disponible'), el('p', 'muted', `${assigned.length} clientes asignados`));
    const actions = el('div', 'advisor-row-actions');
    actions.append(el('strong', 'pending-count', `${pending} pendientes`));
    if (assigned.length) actions.append(button('Borrar tareas', 'danger-button', () => resetAdvisorTasks(advisor, assigned.length)));
    if (assigned.length) actions.append(button('Borrar clientes', 'danger-button', () => deleteAdvisorClients(advisor, assigned.length)));
    actions.append(button('Borrar asesor', 'danger-button', () => deleteAdvisor(advisor)));
    head.append(copy, actions); section.append(head);
    if (!assigned.length) section.append(el('p', 'empty-inline', 'Aún no tiene clientes.'));
    const list = el('ul', 'pending-list');
    for (const client of assigned) {
      const item = el('li');
      item.append(el('strong', '', client.name), el('span', 'muted', ` · ${client.tasks.filter(task => !task.completed).length} pendientes`));
      const taskList = el('ul', 'pending-titles');
      client.tasks.filter(task => !task.completed).forEach(task => taskList.append(el('li', '', task.title)));
      item.append(taskList); list.append(item);
    }
    section.append(list); overview.append(section);
  }
  const manage = el('aside', 'admin-management'), form = el('form', 'editor-form');
  form.append(el('h2', '', 'Nuevo cliente comercial'));
  const name = input('text', 'Ej. Ferretería Norte'); name.minLength = 2; name.maxLength = 100;
  const type = el('select');
  for (const value of ['Ferretería', 'Constructora', 'Distribuidor', 'Otro']) {
    const option = el('option', '', value); option.value = value; type.append(option);
  }
  const advisor = el('select');
  advisors.forEach(item => { const option = el('option', '', item.full_name); option.value = item.user_id; advisor.append(option); });
  form.append(field('Nombre del negocio', name), field('Tipo de cliente', type), field('Asesor responsable', advisor));
  const error = el('p', 'form-error'); error.setAttribute('role', 'alert');
  const submit = el('button', 'primary', 'Crear cliente y tareas'); submit.type = 'submit'; submit.disabled = !advisors.length;
  form.append(error, submit);
  form.addEventListener('submit', async event => {
    event.preventDefault(); error.textContent = ''; submit.disabled = true; submit.textContent = 'Guardando…';
    const result = await db.from('mvp_clients').insert({ name: name.value.trim(), type: type.value, advisor_id: advisor.value });
    if (result.error) { error.textContent = result.error.message; submit.disabled = false; submit.textContent = 'Crear cliente y tareas'; return; }
    await refresh('Cliente creado con cuatro tareas.');
  });
  manage.append(form); layout.append(overview, manage); page.append(layout);
}
function advisorPage(page) {
  page.className = 'advisor-page';
  const hero = intro('Mi cartera de clientes', 'Tareas comerciales de los negocios que tienes asignados.', 'advisor-intro');
  hero.firstChild.prepend(el('span', 'advisor-kicker', 'BIENVENIDO A TU TABLERO'));
  hero.append(el('p', 'advisor-quote', 'Pequeñas acciones construyen grandes resultados'));
  page.append(hero);
  const tasks = clients.flatMap(client => client.tasks);
  const completed = tasks.filter(task => task.completed).length;
  const ownRanking = ranking.find(row => row.advisor_id === user?.id);
  page.append(metrics([['Mis clientes', clients.length, 'negocios asignados'], ['Por completar', tasks.filter(task => !task.completed).length, 'tareas pendientes'], ['Completadas', completed, 'acciones realizadas'], ['XP', ownRanking ? getXp(completed) : 0, '10 XP por tarea'], ['Posición', ownRanking ? `#${ownRanking.position}` : '—', 'ranking global']], true));
  if (!clients.length) { page.append(el('p', 'empty-state', 'Todavía no tienes clientes. El administrador puede asignarte uno.')); return; }
  const overview = el('div', 'advisor-overview'), panel = el('section', 'advisor-client-panel'), rail = el('div', 'customer-rail');
  if (clients.length === 1) panel.classList.add('single-client');
  panel.append(el('h2', 'section-title', 'Mis clientes'));
  const list = el('ul', 'customer-list');
  for (const client of clients) {
    const item = el('li');
    const control = button('', `customer-option${client.id === selectedId ? ' selected' : ''}`, () => { selectedId = client.id; aiRecommendation = ''; saleNotice = ''; render(); });
    control.setAttribute('aria-pressed', String(client.id === selectedId));
    control.append(el('strong', '', client.name), el('span', 'muted', `${client.type} · ${client.tasks.filter(task => !task.completed).length} pendientes`));
    item.append(control); list.append(item);
  }
  rail.append(list); panel.append(rail);
  const client = clients.find(item => item.id === selectedId) ?? clients[0], detail = el('div', 'customer-detail');
  const progress = getProgress(client.tasks), section = el('section', 'progress-section'), info = el('div', 'progress-details');
  info.append(el('p', 'customer-type', client.type), el('h2', 'participant-name', client.name));
  const line = el('div', 'progress-line');
  line.append(el('span', '', `${progress.completed} de ${progress.total} tareas completadas`), el('strong', '', `${progress.rounded} %`));
  const bar = el('progress'); bar.max = 100; bar.value = progress.percentage; info.append(line, bar);
  const mascot = el('div', 'mascot');
  const image = el('img', 'mascot-image');
  image.src = mascotImages[progress.mascot];
  image.alt = `Mascota: ${mascotLabels[progress.mascot]}`;
  mascot.append(image);
  mascot.append(el('p', 'mascot-state', mascotLabels[progress.mascot])); section.append(info, mascot); detail.append(section);
  if (progress.total > 0 && progress.completed === progress.total) detail.append(el('p', 'client-complete-note', '¡Todo al día! Has completado todas las tareas de este cliente.'));
  if (progress.total === 4 && progress.completed === 4) {
    detail.append(button('Limpiar tareas completadas', 'secondary clear-tasks-button', () => clearCompletedTasks(client)));
  }
  panel.append(detail); overview.append(rankingSection(), panel); page.append(overview);
  const aiSection = el('section', 'ai-recommendation');
  aiSection.append(el('h2', 'section-title', 'Trompín · Asistente comercial'));
  if (aiRecommendation) aiSection.append(el('p', '', aiRecommendation));
  aiSection.append(button('Sugerir siguiente acción', 'secondary', event => requestRecommendation(client, event.currentTarget)));
  page.append(aiSection);
  const taskSection = el('section', 'tasks-section'); taskSection.append(el('h2', 'section-title', 'Tareas de este cliente'));
  if (saleNotice) taskSection.append(el('p', 'sale-notice', saleNotice));
  const taskList = el('ol', 'task-list');
  for (const task of client.tasks) {
    const item = el('li', 'task'), content = el('div', 'task-content'), actions = el('div', 'task-actions');
    content.append(el('h3', '', task.title), el('p', 'task-description', task.description));
    actions.append(el('span', `task-status${task.completed ? ' completed' : ''}`, task.completed ? 'Completada' : 'Pendiente'));
    if (!task.completed) actions.append(button('Completar tarea', 'secondary', async event => {
      const control = event.currentTarget; control.disabled = true; control.textContent = 'Guardando…';
      const progressBefore = getProgress(client.tasks);
      const wasLastTask = progressBefore.isLastTaskPending;
      const result = await db.rpc('complete_mvp_task', { target_task: task.id });
      if (!isTaskCompletionConfirmed(result)) {
        control.disabled = false; control.textContent = 'Completar tarea';
        notice(result?.error?.message || 'La tarea ya fue actualizada. Recarga los datos.', true); return;
      }
      saleNotice = wasLastTask ? '¡Listo! Completaste la venta. La métrica ya llegó a tu administrador.' : '';
      if (wasLastTask) celebrateCompletion();
      await refresh(wasLastTask ? '' : 'Tarea completada.');
      const completedTasks = progressBefore.completed + 1;
      releaseMascotHeart(completedTasks);
      if (shouldShowEncouragement(completedTasks)) {
        window.setTimeout(() => releaseMascotMessage(completedTasks), 500);
      }
    }));
    item.append(content, actions); taskList.append(item);
  }
  taskSection.append(taskList); page.append(taskSection);
}
async function refresh(text) {
  try { await loadData(); render(); notice(text); }
  catch (cause) { notice(`El cambio se guardó, pero no se pudo actualizar la vista: ${cause.message}`, true); }
}
function render() {
  shell();
  const page = document.querySelector('#page');
  if (!db) page.replaceChildren(el('p', 'empty-state', 'Falta configurar Supabase en .env.local.'));
  else if (!profile) authPage();
  else if (profile.role === 'admin') adminPage(page);
  else advisorPage(page);
}
if (db) boot(); else render();
