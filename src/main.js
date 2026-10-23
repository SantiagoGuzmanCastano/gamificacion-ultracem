import './style.css';
import './shop.css';
import './advisor.css';
import './rewards.css';
import { renderShop, renderHalloweenCollection } from './shop.js';
import { renderRewards } from './rewards.js';
import { createClient } from '@supabase/supabase-js';
import { getMascotStateForCurrentClient, getProgress, getXp, isTaskCompletionConfirmed } from './game.js';
import { mascotImages, mascotLabels } from './mascot.js';
import { getMonthlyTons, getSalesStreak, getWeeklySales, getRankingSlots, getPortfolioProgress, getMonthlyGoal, getClientSaleState, getClientHistoryStatus, isCurrentClient } from './advisor-metrics.js';
import { advisorIcon } from './advisor-icons.js';
import { clearMascotFeedback, showMascotFeedback } from './mascot-feedback.js';
import { clearAdvisorEntrance, playAdvisorEntrance, resetAdvisorEntrance } from './advisor-entrance.js';
import { clearAdvisorEffects, celebrateTask, celebrateSale, revealRecommendation } from './advisor-effects.js';
import { isValidProfileImage, profileImageExtension } from './profile.js';
import { createProfileAvatar, createProfilePhotoPicker, renderAdvisorProfile, playProfileEntrance, clearProfileEntrance } from './profile-view.js';
import { showLoadingScreen, clearLoadingScreen } from './loading-screen.js';
import { attachRankingAvatars } from './ranking-avatars.js';
import { COLOMBIA_DEPARTMENTS, citiesForDepartment, normalizeClientLocation } from './client-location.js';

const db = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) : null;
const root = document.querySelector('#app');
let user = null, profile = null, advisors = [], clients = [], sales = [], ranking = [], selectedId = null, aiRecommendation = '', saleNotice = '';
let theme = localStorage.getItem('ultracem-theme') || 'light';
let advisorView = 'dashboard', adminView = 'dashboard';
let advisorMapModule;
let halloweenEnabled = false, halloweenReady = false, halloweenSaving = false, halloweenError = '';
let halloweenTimer = null, halloweenRequest = 0;
let noticeTimer = null;
let profilePhotoPromptPending = false;
let profilePhotoUrlTimer = null;
let profilePhotoSaving = false;
let profileKeyboardNavigation = false;
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
function profileAvatar(className = 'profile-avatar') {
  return createProfileAvatar(profile, className === 'profile-avatar' ? '' : className);
}
async function signOut() {
  const result = await db.auth.signOut();
  if (result.error) { notice('No se pudo cerrar la sesión. Intenta de nuevo.', true); return; }
  resetAdvisorEntrance();
  stopHalloweenSync();
  window.clearInterval(profilePhotoUrlTimer);
  profilePhotoUrlTimer = null;
  user = profile = null; advisors = clients = sales = ranking = []; aiRecommendation = ''; saleNotice = ''; advisorView = 'dashboard'; adminView = 'dashboard';
  render();
}
function scheduleProfilePhotoUrlRefresh() {
  window.clearInterval(profilePhotoUrlTimer);
  profilePhotoUrlTimer = null;
  if (!profile.avatar_path && !ranking.some(row => row.avatar_url)) return;
  profilePhotoUrlTimer = window.setInterval(async () => {
    const viewerId = user?.id;
    const ownPath = profile?.avatar_path;
    if (!profile || !viewerId) return;
    try {
      const [signed, photos] = await Promise.all([
        ownPath ? db.storage.from('advisor-profile-photos').createSignedUrl(ownPath, 3600) : null,
        attachRankingAvatars(db, ranking, profile),
      ]);
      if (user?.id !== viewerId || !profile) return;
      if (profile.avatar_path === ownPath && signed?.data?.signedUrl) profile.avatar_url = signed.data.signedUrl;
      ranking = photos.map(row => row.advisor_id === viewerId ? { ...row, avatar_url: profile.avatar_url } : row);
      document.querySelectorAll('.profile-avatar').forEach(node => {
        if (node.classList.contains('ranking-avatar')) {
          const row = ranking.find(item => item.advisor_id === node.dataset.advisorId);
          if (row) node.replaceWith(createProfileAvatar(row, 'ranking-avatar'));
        } else if (node.tagName === 'IMG' && profile.avatar_url) node.src = profile.avatar_url;
      });
    } catch { /* Keep existing photos if background renewal is unavailable. */ }
  }, 50 * 60 * 1000);
}
async function markProfilePhotoPrompted() {
  const result = await db.from('mvp_profiles').update({ photo_prompted_at: new Date().toISOString() }).eq('user_id', user.id);
  if (result.error) throw result.error;
  profilePhotoPromptPending = false;
}
async function uploadProfilePhoto(file) {
  if (profilePhotoSaving) return;
  if (!isValidProfileImage(file)) {
    notice('Selecciona una imagen JPG, PNG o WebP de máximo 5 MB.', true);
    return;
  }
  setProfilePhotoBusy(true);
  try {
    const path = `${user.id}/${crypto.randomUUID()}.${profileImageExtension(file)}`;
    const upload = await db.storage.from('advisor-profile-photos').upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) { notice('No se pudo guardar la foto. Intenta de nuevo.', true); return; }
    const previousPath = profile.avatar_path;
    const update = await db.from('mvp_profiles').update({ avatar_path: path, photo_prompted_at: new Date().toISOString() }).eq('user_id', user.id);
    if (update.error) {
      await db.storage.from('advisor-profile-photos').remove([path]);
      notice('No se pudo guardar la foto. Intenta de nuevo.', true);
      return;
    }
    if (previousPath) await db.storage.from('advisor-profile-photos').remove([previousPath]);
    const signed = await db.storage.from('advisor-profile-photos').createSignedUrl(path, 3600);
    profile.avatar_path = path;
    profile.avatar_url = signed.data?.signedUrl || '';
    ranking = ranking.map(row => row.advisor_id === user.id ? { ...row, avatar_url: profile.avatar_url } : row);
    scheduleProfilePhotoUrlRefresh();
    profilePhotoPromptPending = false;
    document.querySelector('.profile-dialog-backdrop')?.remove();
    render();
    notice('Foto de perfil actualizada.');
  } catch {
    notice('No se pudo guardar la foto. Intenta de nuevo.', true);
  } finally {
    setProfilePhotoBusy(false);
  }
}
function setProfilePhotoBusy(busy) {
  profilePhotoSaving = busy;
  document.querySelectorAll('.profile-photo-action').forEach(control => { control.disabled = busy; });
  document.querySelectorAll('.profile-upload-label').forEach(label => { label.textContent = busy ? 'Guardando foto…' : label.dataset.defaultLabel; });
  document.querySelectorAll('.profile-upload-status').forEach(status => { status.textContent = busy ? 'Guardando foto…' : ''; });
  document.querySelector('.profile-photo-settings')?.setAttribute('aria-busy', String(busy));
}
async function removeProfilePhoto() {
  if (profilePhotoSaving || !profile.avatar_path) return;
  if (!window.confirm('¿Quitar tu foto de perfil?')) return;
  const removed = await db.storage.from('advisor-profile-photos').remove([profile.avatar_path]);
  if (removed.error) { notice('No se pudo quitar la foto. Intenta de nuevo.', true); return; }
  const update = await db.from('mvp_profiles').update({ avatar_path: null }).eq('user_id', user.id);
  if (update.error) { notice('No se pudo actualizar el perfil. Intenta de nuevo.', true); return; }
  profile.avatar_path = null;
  profile.avatar_url = '';
  ranking = ranking.map(row => row.advisor_id === user.id ? { ...row, avatar_url: '' } : row);
  render();
  notice('Foto de perfil eliminada.');
}
async function deleteAccount() {
  if (!window.confirm('¿Borrar tu cuenta, clientes, tareas, ventas y progreso? Esta acción no se puede deshacer.')) return;
  if (!window.confirm('Confirma nuevamente: borrar todo definitivamente.')) return;
  const result = await db.rpc('delete_mvp_own_account');
  if (result.error) { notice('No se pudo borrar la cuenta. Intenta de nuevo.', true); return; }
  user = profile = null; advisors = clients = sales = ranking = []; aiRecommendation = ''; saleNotice = '';
  render();
}
function openProfilePanel(prompt = false) {
  document.querySelector('.profile-dialog-backdrop')?.remove();
  const backdrop = el('div', 'profile-dialog-backdrop');
  const dialog = el('section', 'profile-dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'profile-dialog-title');
  const title = el('h2', '', prompt ? 'Añade tu foto' : 'Tu perfil');
  title.id = 'profile-dialog-title';
  dialog.append(profileAvatar('profile-dialog-avatar'), title, el('p', 'muted', prompt ? 'Elige una foto desde tu dispositivo o continúa sin foto.' : 'Actualiza tu foto cuando quieras.'));
  dialog.append(createProfilePhotoPicker(uploadProfilePhoto, { prompt, busy: profilePhotoSaving }));
  if (prompt) dialog.append(button('Continuar sin foto', 'text-button profile-photo-action', async () => { try { await markProfilePhotoPrompted(); backdrop.remove(); } catch (cause) { notice(cause.message, true); } }));
  else dialog.append(button('Cerrar sesión', 'text-button profile-signout', signOut));
  backdrop.append(dialog);
  backdrop.addEventListener('click', event => { if (event.target === backdrop && !prompt) backdrop.remove(); });
  document.body.append(backdrop);
  dialog.querySelector('button')?.focus();
}
function advisorProfileCard() {
  const card = el('section', 'advisor-profile-card');
  card.append(profileAvatar(), el('div', 'advisor-profile-copy', profile.full_name));
  card.append(button('Perfil', 'profile-button', event => { profileKeyboardNavigation = event.detail === 0; advisorView = 'profile'; render(); }));
  return card;
}
function notice(text, error = false) {
  const node = document.querySelector('#notice');
  window.clearTimeout(noticeTimer);
  node.textContent = text;
  node.hidden = !text;
  node.classList.toggle('error-notice', error);
  const successToast = !error && ['Skin equipada.', 'Foto de perfil actualizada.', 'Foto de perfil eliminada.'].includes(text);
  const validationToast = error && text === 'Selecciona una imagen JPG, PNG o WebP de máximo 5 MB.';
  node.classList.toggle('success-notice', successToast);
  node.classList.toggle('validation-notice', validationToast);
  if (successToast || validationToast) noticeTimer = window.setTimeout(() => { node.hidden = true; }, validationToast ? 6000 : 3200);
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
  clearLoadingScreen(root);
  clearAdvisorEffects();
  clearAdvisorEntrance();
  clearMascotFeedback();
  root.className = !profile ? 'auth-shell' : profile.role !== 'admin' ? 'advisor-shell' : 'admin-shell';
  root.innerHTML = !profile
    ? '<main class="auth-main"><p id="notice" class="notice" role="status" hidden></p><div id="page"></div></main>'
    : '<header class="topbar"><div class="brand"><img src="/ultracem-logo.png" alt="Ultracem"><span>Gamificación</span><span class="demo-badge">MVP</span></div><div class="top-actions" id="actions"></div></header><div class="app-layout"><aside class="app-sidebar" aria-label="Navegación"><div class="sidebar-caption">GAMIFICACIÓN</div><div class="sidebar-nav"></div><div class="sidebar-bottom"><span class="sidebar-pulse"></span><span>Ruta comercial</span><small>Panel operativo</small></div></aside><main><p id="notice" class="notice" role="status" hidden></p><div id="page"></div><footer>Acciones comerciales de demostración. Completar una tarea no acredita una venta.</footer></main></div>';
  if (profile && profile.role !== 'admin') {
    const sidebar = root.querySelector('.app-sidebar');
    const brand = el('div', 'sidebar-brand');
    brand.innerHTML = '<img class="sidebar-logo" src="/ultracem-logo.png" alt="Ultracem">';
    const caption = sidebar.querySelector('.sidebar-caption');
    caption.textContent = 'GAMIFICACIÓN';
    caption.after(el('span', 'sidebar-mvp', 'MVP'));
    sidebar.prepend(brand);
    sidebar.append(el('p', 'sidebar-motto', 'CONSTRUYENDO UN MUNDO MÁS FUERTE'), advisorProfileCard());
    const navigate = (view, event) => {
      profileKeyboardNavigation = event.detail === 0;
      advisorView = view;
      render();
      if (view === 'shop') refreshHalloween();
      window.scrollTo(0, 0);
      const heading = document.querySelector('#page h1');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    };
    const nav = sidebar.querySelector('.sidebar-nav');
    nav.setAttribute('aria-label', 'Portal del asesor');
    sidebar.setAttribute('aria-label', 'Navegación del asesor');
    nav.replaceChildren();
    const mobileNav = el('nav', 'advisor-nav');
    mobileNav.setAttribute('aria-label', 'Portal del asesor');
    for (const [view, label, icon] of [['dashboard', 'Inicio', 'home'], ['history', 'Historial clientes', 'clients'], ['map', 'Mapa clientela', 'map'], ['shop', 'Tienda', 'shop'], ['rewards', 'Premios', 'gift'], ['profile', 'Perfil', 'profile']]) {
      for (const [container, className] of [[nav, 'sidebar-item'], [mobileNav, '']]) {
        const control = button(label, className, event => navigate(view, event));
        const navIcon = el('span', 'advisor-nav-icon');
        navIcon.innerHTML = advisorIcon(icon);
        control.prepend(navIcon);
        if (advisorView === view) {
          control.classList.add('active');
          control.setAttribute('aria-current', 'page');
        }
        container.append(control);
      }
    }
    document.querySelector('main').prepend(mobileNav);
  } else if (profile?.role === 'admin') {
    const sidebar = root.querySelector('.app-sidebar');
    const nav = sidebar.querySelector('.sidebar-nav');
    const navigate = view => { adminView = view; render(); window.scrollTo(0, 0); };
    nav.setAttribute('aria-label', 'Portal de administración');
    for (const [view, label, icon] of [['dashboard', 'Tablero de admin', '01'], ['shop', 'Tienda', '02']]) {
      const control = button(label, 'sidebar-item', () => navigate(view));
      control.prepend(el('b', '', icon));
      if (adminView === view) { control.classList.add('active'); control.setAttribute('aria-current', 'page'); }
      nav.append(control);
    }
  }
  if (profile) {
    const actions = document.querySelector('#actions');
    if (profile.role === 'admin') actions.append(el('span', 'session-name', `${profile.full_name} · Administrador`));
    const themeToggle = button('', 'theme-button', () => {
      const applyTheme = () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('ultracem-theme', theme);
        document.documentElement.dataset.theme = theme;
        shell();
        render();
      };
      if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(applyTheme);
      else applyTheme();
    });
    themeToggle.innerHTML = '<span class="theme-toggle-icon" aria-hidden="true"><i></i></span><span class="theme-toggle-label"></span>';
    themeToggle.querySelector('.theme-toggle-label').textContent = theme === 'dark' ? 'Claro' : 'Oscuro';
    themeToggle.setAttribute('aria-label', `Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`);
    themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
    actions.append(themeToggle);
    if (profile.role === 'admin') actions.append(button('Cerrar sesión', 'text-button', signOut));
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
  let own = await db.from('mvp_profiles').select('user_id,full_name,role,equipped_skin,avatar_path,photo_prompted_at').eq('user_id', user.id).single();
  if (own.error && /avatar_path|photo_prompted_at|column/i.test(own.error.message || '')) {
    own = await db.from('mvp_profiles').select('user_id,full_name,role,equipped_skin').eq('user_id', user.id).single();
    if (!own.error) own.data.photo_prompted_at = new Date().toISOString();
  }
  if (own.error) throw own.error;
  profile = own.data;
  profile.avatar_url = '';
  if (profile.avatar_path) {
    const signed = await db.storage.from('advisor-profile-photos').createSignedUrl(profile.avatar_path, 3600);
    profile.avatar_url = signed.data?.signedUrl || '';
  }
  profilePhotoPromptPending = profile.role === 'advisor' && !profile.photo_prompted_at;
  if (profile.role === 'admin') {
    const list = await db.rpc('get_mvp_advisors');
    if (list.error) throw list.error;
    advisors = (list.data ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name));
  } else advisors = [];
  const result = await db.from('mvp_clients').select('id,name,type,advisor_id,department,city,tons_requested,mvp_tasks(id,title,description,completed_at)').order('created_at', { ascending: false });
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
  const salesResult = await db.from('mvp_sales').select('id,client_id,advisor_id,amount,tons_sold,completed_at,confirmed,confirmed_at');
  if (salesResult.error) throw salesResult.error;
  sales = salesResult.data ?? [];
  const rankingResult = await db.rpc('get_mvp_advisor_ranking');
  if (rankingResult.error) throw rankingResult.error;
  ranking = await attachRankingAvatars(db, rankingResult.data ?? [], profile);
  scheduleProfilePhotoUrlRefresh();
  if (!clients.some(client => client.id === selectedId)) selectedId = clients[0]?.id ?? null;
}
async function boot() {
  stopHalloweenSync();
  shell();
  showLoadingScreen(root);
  try {
    const result = await db.auth.getUser();
    user = result.data.user;
    if (!user) { resetAdvisorEntrance(); profile = null; render(); return; }
    await loadData();
    await refreshHalloween();
    render();
    halloweenTimer = window.setInterval(() => {
      if (!document.hidden && (profile?.role === 'admin' || advisorView === 'shop')) refreshHalloween();
    }, 10000);
  }
  catch (cause) {
    shell();
    document.querySelector('#page').replaceChildren(el('p', 'empty-state', 'No se pudieron cargar los datos.'), button('Reintentar', 'primary', boot));
    notice(cause.message, true);
  }
}
function stopHalloweenSync() {
  window.clearInterval(halloweenTimer);
  halloweenTimer = null;
  halloweenRequest++;
  halloweenEnabled = halloweenReady = halloweenSaving = false;
  halloweenError = '';
}
function paintHalloween() {
  const control = document.querySelector('#halloween-toggle');
  if (control) {
    control.disabled = !halloweenReady || halloweenSaving;
    control.textContent = halloweenSaving ? 'Guardando…' : halloweenEnabled ? 'Desactivar Halloween' : 'Activar Halloween';
    control.setAttribute('aria-pressed', String(halloweenEnabled));
    document.querySelector('#halloween-status').textContent = halloweenError || `Modo Halloween ${halloweenEnabled ? 'activado' : 'desactivado'}.`;
  }
  const page = document.querySelector('.shop-page');
  if (page) {
    renderHalloweenCollection(page, halloweenReady && halloweenEnabled, profile?.equipped_skin, ranking.find(row => row.advisor_id === user?.id)?.confirmed_sales ?? 0, equipSkin);
    const status = page.querySelector('.shop-mode-status');
    status.textContent = halloweenError;
    status.hidden = !halloweenError;
  }
}
async function equipSkin(skin) {
  const result = await db.rpc('equip_mvp_skin', { target_skin: skin });
  if (result.error) { notice(result.error.message, true); return; }
  profile.equipped_skin = result.data;
  render();
  notice('Skin equipada.');
}
async function refreshHalloween() {
  if (!user || !profile || halloweenSaving) return;
  const currentUser = user.id, request = ++halloweenRequest;
  try {
    const result = await db.from('mvp_app_settings').select('halloween_enabled').eq('id', true).single().abortSignal(AbortSignal.timeout(5000));
    if (result.error) throw result.error;
    if (currentUser !== user?.id || request !== halloweenRequest) return;
    halloweenEnabled = result.data.halloween_enabled === true;
    halloweenReady = true;
    halloweenError = '';
  } catch {
    if (currentUser !== user?.id || request !== halloweenRequest) return;
    halloweenEnabled = halloweenReady = false;
    halloweenError = 'No se pudo consultar el modo Halloween. Se reintentará automáticamente.';
  }
  paintHalloween();
}
async function toggleHalloween() {
  if (profile?.role !== 'admin' || !halloweenReady || halloweenSaving) return;
  const currentUser = user.id, request = ++halloweenRequest;
  halloweenSaving = true;
  paintHalloween();
  try {
    const result = await db.from('mvp_app_settings').update({ halloween_enabled: !halloweenEnabled }).eq('id', true).select('halloween_enabled').single().abortSignal(AbortSignal.timeout(10000));
    if (result.error) throw result.error;
    if (currentUser !== user?.id || request !== halloweenRequest) return;
    halloweenEnabled = result.data.halloween_enabled === true;
    halloweenError = '';
    notice(`Modo Halloween ${halloweenEnabled ? 'activado' : 'desactivado'} para todos los asesores.`);
  } catch {
    if (currentUser !== user?.id || request !== halloweenRequest) return;
    notice('No se pudo guardar el modo Halloween. Intenta de nuevo.', true);
  } finally {
    if (currentUser === user?.id && request === halloweenRequest) {
      halloweenSaving = false;
      paintHalloween();
    }
  }
}
function halloweenControl() {
  const section = el('section', 'editor-form');
  section.setAttribute('aria-labelledby', 'halloween-control-title');
  const title = el('h2', '', 'Modo Halloween'); title.id = 'halloween-control-title';
  const status = el('p', 'muted'); status.id = 'halloween-status'; status.setAttribute('role', 'status');
  const control = button('', 'primary', toggleHalloween); control.id = 'halloween-toggle';
  section.append(title, el('p', 'muted', 'Muestra los dos atuendos exclusivos en la tienda de todos los asesores.'), status, control);
  return section;
}
window.addEventListener('focus', () => { if (db && !document.hidden) refreshHalloween(); });
window.addEventListener('pagehide', stopHalloweenSync);
window.addEventListener('pageshow', event => { if (event.persisted && db) boot(); });
function metrics(items, advisor = false) {
  const row = el('div', 'metrics');
  if (advisor) row.classList.add('advisor-metrics');
  for (const [index, [label, value, note, countTarget]] of items.entries()) {
    const item = el('div', 'metric');
    if (advisor) {
      const icon = el('span', 'metric-icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = advisorIcon(['clients', 'truck', 'sales', 'trophy'][index]);
      item.append(icon);
    }
    item.append(el('span', 'metric-label', label), el('strong', 'metric-value', String(value)), el('span', 'metric-note', note));
    if (advisor && Number.isFinite(countTarget)) {
      const count = item.querySelector('.metric-value');
      count.dataset.countTarget = String(countTarget);
      count.dataset.countSuffix = index === 1 ? ' t' : '';
    }
    row.append(item);
  }
  return row;
}
function rankingSection(advisor = false) {
  const section = el('section', 'ranking-section');
  if (advisor) section.classList.add('advisor-ranking');
  section.append(el('h2', 'section-title', 'Ranking de asesores'), el('p', 'muted', 'El ranking se ordena por ventas confirmadas.'));
  if (!ranking.length && !advisor) {
    section.append(el('p', 'empty-state', 'Aún no hay asesores con actividad registrada.'));
    return section;
  }
  const list = el('ol', 'ranking-list');
  for (const row of advisor ? getRankingSlots(ranking) : ranking) {
    const confirmedSales = Number(row.confirmed_sales ?? row.sales ?? 0);
    const item = el('li', 'ranking-row' + (row.advisor_id === user?.id ? ' current' : ''));
    const identity = el('div', 'ranking-identity');
    const person = el('div', 'ranking-person');
    if (!row.placeholder) person.append(createProfileAvatar(row, 'ranking-avatar'));
    person.append(identity);
    if (advisor) {
      item.classList.toggle('ranking-placeholder', Boolean(row.placeholder));
      const rank = el('span', 'rank-medal', String(row.position));
      identity.append(el('strong', '', row.full_name), el('span', 'muted', row.placeholder ? 'Posición disponible' : row.advisor_id === user?.id ? 'Tu posición actual' : 'Asesor comercial'));
      const values = el('div', 'ranking-values');
      const count = el('span', 'ranking-sales-value', row.placeholder ? '—' : String(confirmedSales));
      count.append(el('small', '', 'ventas'));
      const tons = el('span', 'ranking-tons-value', row.placeholder ? '—' : `${Number(row.confirmed_tons || 0).toLocaleString('es-CO')} t`);
      tons.append(el('small', '', 'vendidas'));
      values.append(count, tons); item.append(rank, person, values); list.append(item);
      continue;
    }
    identity.append(el('strong', '', `${row.position}. ${row.full_name}`), el('span', 'muted', `${confirmedSales} ventas · ${Number(row.confirmed_tons || 0).toLocaleString('es-CO')} toneladas`));
    item.append(person, el('strong', 'ranking-xp', `${confirmedSales} ventas`));
    list.append(item);
  }
  section.append(list);
  return section;
}
function adminMetricsSection() {
  const confirmedSales = sales.filter(sale => sale.confirmed);
  const totalAmount = confirmedSales.reduce((total, sale) => total + Number(sale.amount || 0), 0);
  const totalTons = confirmedSales.reduce((total, sale) => total + Number(sale.tons_sold || 0), 0);
  const section = el('section', 'metrics-dashboard');
  section.append(el('h2', 'section-title', 'Métricas generales'), el('p', 'muted', 'Resultados simulados a partir de misiones completadas.'));
  section.append(metrics([['Ventas confirmadas', confirmedSales.length, 'cierres registrados'], ['Toneladas vendidas', totalTons.toLocaleString('es-CO'), 'volumen comercial'], ['Valor acumulado', `$${totalAmount.toLocaleString('es-CO')}`, 'valor de prueba']]));
  const list = el('ul', 'metrics-breakdown');
  for (const advisor of advisors) {
    const advisorSales = confirmedSales.filter(sale => sale.advisor_id === advisor.user_id);
    const amount = advisorSales.reduce((total, sale) => total + Number(sale.amount || 0), 0);
    const tons = advisorSales.reduce((total, sale) => total + Number(sale.tons_sold || 0), 0);
    const item = el('li', 'metrics-breakdown-row');
    const details = el('div', 'metrics-advisor-details');
    details.append(el('strong', '', advisor.full_name), el('span', 'muted', `${advisorSales.length} ventas · ${tons.toLocaleString('es-CO')} toneladas · $${amount.toLocaleString('es-CO')}`));
    for (const sale of advisorSales) {
      const client = clients.find(item => item.id === sale.client_id);
      details.append(el('span', 'metrics-sale-client', `${client?.name || 'Cliente eliminado'} · ${Number(sale.tons_sold || 0).toLocaleString('es-CO')} toneladas · $${Number(sale.amount).toLocaleString('es-CO')}`));
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
  const assistant = control.closest('.action-assistant');
  const resultBox = assistant.querySelector('.assistant-result');
  control.disabled = true;
  control.textContent = 'Analizando…';
  assistant.classList.add('is-thinking');
  resultBox.setAttribute('aria-busy', 'true');
  const progress = getProgress(client.tasks);
  try {
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
    if (!control.isConnected || selectedId !== client.id) return;
    if (result.error || result.data?.error) throw new Error(result.data?.error || result.error.message);
    if (!result.data?.recommendation?.trim()) throw new Error('No se pudo generar la recomendación. Intenta de nuevo.');
    aiRecommendation = result.data.recommendation;
    resultBox.querySelector('.assistant-result-text').textContent = aiRecommendation;
    resultBox.hidden = false;
    revealRecommendation(resultBox);
  } catch (cause) {
    if (control.isConnected) notice(cause.message || 'No se pudo generar la recomendación.', true);
  } finally {
    if (control.isConnected) {
      assistant.classList.remove('is-thinking');
      resultBox.setAttribute('aria-busy', 'false');
      control.disabled = false;
      control.textContent = 'Sugerir siguiente acción';
    }
  }
}
function adminPage(page) {
  const tasks = clients.flatMap(client => client.tasks);
  page.className = 'admin-page';
  page.append(intro('Panorama comercial', 'Clientes y tareas pendientes por asesor.', 'admin-intro'));
  const totalSales = ranking.reduce((total, row) => total + Number(row.confirmed_sales || 0), 0);
  const totalTons = ranking.reduce((total, row) => total + Number(row.confirmed_tons || 0), 0);
  page.append(metrics([['Asesores', advisors.length, 'cuentas registradas'], ['Clientes comerciales', clients.length, 'negocios asignados'], ['Tareas pendientes', tasks.filter(task => !task.completed).length, 'acciones por completar'], ['Ventas confirmadas', totalSales, 'resultado comercial'], ['Toneladas vendidas', totalTons.toLocaleString('es-CO'), 'volumen comercial']]));
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
      const location = client.city && client.department ? ` · ${client.city}, ${client.department}` : '';
      item.append(el('strong', '', client.name), el('span', 'muted', `${location} · ${client.tasks.filter(task => !task.completed).length} pendientes`));
      const taskList = el('ul', 'pending-titles');
      client.tasks.filter(task => !task.completed).forEach(task => taskList.append(el('li', '', task.title)));
      item.append(taskList); list.append(item);
    }
    section.append(list); overview.append(section);
  }
  const manage = el('aside', 'admin-management'), form = el('form', 'editor-form');
  form.append(el('h2', '', 'Nuevo cliente comercial'));
  const name = input('text', 'Ej. Ferretería Norte'); name.minLength = 2; name.maxLength = 100;
  const city = el('select'); city.required = true; city.disabled = true;
  const cityPlaceholder = el('option', '', 'Selecciona primero un departamento');
  cityPlaceholder.value = ''; cityPlaceholder.disabled = true; city.append(cityPlaceholder);
  const tons = input('number', 'Ej. 125.5'); tons.min = '0.01'; tons.step = '0.01';
  const type = el('select');
  for (const value of ['Ferretería', 'Constructora', 'Distribuidor', 'Otro']) {
    const option = el('option', '', value); option.value = value; type.append(option);
  }
  const department = el('select');
  const departmentPlaceholder = el('option', '', 'Selecciona un departamento');
  departmentPlaceholder.value = ''; departmentPlaceholder.disabled = true; departmentPlaceholder.selected = true;
  department.append(departmentPlaceholder);
  COLOMBIA_DEPARTMENTS.forEach(value => { const option = el('option', '', value); option.value = value; department.append(option); });
  department.required = true;
  department.addEventListener('change', () => {
    city.replaceChildren();
    const placeholder = el('option', '', 'Selecciona una ciudad');
    placeholder.value = ''; placeholder.disabled = true; city.append(placeholder);
    for (const value of citiesForDepartment(department.value)) {
      const option = el('option', '', value); option.value = value; city.append(option);
    }
    city.value = '';
    city.disabled = !citiesForDepartment(department.value).length;
  });
  const advisor = el('select');
  advisors.forEach(item => { const option = el('option', '', item.full_name); option.value = item.user_id; advisor.append(option); });
  form.append(field('Nombre del negocio', name), field('Departamento', department), field('Ciudad del cliente', city), field('Tipo de cliente', type), field('Asesor responsable', advisor), field('Toneladas solicitadas', tons));
  const error = el('p', 'form-error'); error.setAttribute('role', 'alert');
  const submit = el('button', 'primary', 'Crear cliente y tareas'); submit.type = 'submit'; submit.disabled = !advisors.length;
  form.append(error, submit);
  form.addEventListener('submit', async event => {
    event.preventDefault(); error.textContent = ''; submit.disabled = true; submit.textContent = 'Guardando…';
    const requestedTons = Number(tons.value);
    if (!Number.isFinite(requestedTons) || requestedTons <= 0) { error.textContent = 'Indica una cantidad de toneladas mayor que cero.'; submit.disabled = false; submit.textContent = 'Crear cliente y tareas'; return; }
    const location = normalizeClientLocation(city.value, department.value);
    if (!location) { error.textContent = 'Indica una ciudad válida y selecciona un departamento.'; submit.disabled = false; submit.textContent = 'Crear cliente y tareas'; return; }
    const result = await db.from('mvp_clients').insert({ name: name.value.trim(), type: type.value, advisor_id: advisor.value, city: location.city, department: location.department, tons_requested: requestedTons });
    if (result.error) { error.textContent = result.error.message; submit.disabled = false; submit.textContent = 'Crear cliente y tareas'; return; }
    await refresh('Cliente creado con cuatro tareas.');
  });
  manage.append(halloweenControl(), form); layout.append(overview, manage); page.append(layout);
}
function advisorMapPage(page) {
  page.className = 'advisor-page';
  const welcome = el('header', 'advisor-welcome');
  welcome.append(el('h1', '', 'Mapa clientela'));
  const ownClients = clients.filter(client => client.advisor_id === user?.id);
  const section = el('section', 'advisor-map-panel');
  const status = el('p', 'advisor-map-status', 'Cargando mapa…');
  status.setAttribute('role', 'status');
  const container = el('div', 'advisor-map-canvas');
  container.setAttribute('aria-label', 'Mapa de departamentos de Colombia y ciudades con clientes');
  const legend = el('div', 'advisor-map-legend');
  legend.append(el('span', 'advisor-map-legend-locked', 'Bloqueado'), el('span', 'advisor-map-legend-active', 'Con clientes'));
  section.append(status, container, legend);
  if (!ownClients.length) section.append(el('p', 'empty-state', 'Aún no tienes clientes asignados. Todos los departamentos están bloqueados.'));
  page.append(welcome, section);
  import('./advisor-map.js').then(async module => {
    if (!container.isConnected) return;
    advisorMapModule = module;
    await module.renderAdvisorClientMap(container, ownClients, (state, message) => {
      if (!container.isConnected) return;
      status.textContent = state === 'ready' ? 'Selecciona un departamento o una ciudad para ver tus clientes.' : message;
      status.classList.toggle('advisor-map-error', state === 'error');
    });
  }).catch(error => {
    if (!container.isConnected) return;
    status.textContent = `No se pudo cargar el mapa: ${error.message}`;
    status.classList.add('advisor-map-error');
  });
}
function advisorProfilePage(page) {
  renderAdvisorProfile(page, profile, { upload: uploadProfilePhoto, remove: removeProfilePhoto, signOut, deleteAccount }, profilePhotoSaving);
  playProfileEntrance(page, profileKeyboardNavigation);
}
function advisorHistoryPage(page) {
  page.className = 'advisor-page';
  const ownClients = clients.filter(client => client.advisor_id === user?.id);
  const welcome = el('header', 'advisor-welcome');
  welcome.append(el('h1', '', 'Historial de clientes'), el('p', '', 'Consulta el avance y las ventas de toda tu cartera.'));
  page.append(welcome);
  if (!ownClients.length) {
    page.append(el('p', 'empty-state', 'Aún no tienes clientes en tu historial.'));
    return;
  }
  const list = el('section', 'client-history-list');
  for (const client of ownClients) {
    const status = getClientHistoryStatus(client, sales);
    const progress = getProgress(client.tasks);
    const item = el('article', 'client-history-item');
    const head = el('div', 'client-history-head');
    const location = client.city && client.department ? ` · ${client.city}, ${client.department}` : '';
    const copy = el('div', 'client-history-copy');
    copy.append(el('h2', '', client.name), el('p', 'muted', `${client.type}${location}`));
    const summary = el('div', 'client-history-summary');
    summary.append(
      el('span', `client-history-status${status.current ? '' : ' confirmed'}`, status.label),
      advisorProgressRing(status.percentage, 'avance del cliente', 'portfolio-ring client-history-ring'),
    );
    head.append(copy, summary);
    const details = el('details', 'client-history-tasks');
    details.append(el('summary', '', 'Ver tareas'));
    const tasks = el('ul');
    for (const task of client.tasks) tasks.append(el('li', '', `${task.completed ? '✓' : '○'} ${task.title}`));
    details.append(tasks);
    item.append(head, details); list.append(item);
  }
  page.append(list);
}
function advisorPage(page) {
  page.className = 'advisor-page';
  const portfolio = getPortfolioProgress(clients, sales);
  const currentClients = clients.filter(client => isCurrentClient(client, sales));
  const ownRanking = ranking.find(row => row.advisor_id === user?.id);
  const ownConfirmedSales = sales.filter(sale => sale.advisor_id === user?.id && sale.confirmed);
  const ownTons = ownConfirmedSales.reduce((total, sale) => total + Number(sale.tons_sold || 0), 0);
  const activeClient = currentClients.find(item => item.id === selectedId) ?? currentClients[0] ?? null;
  const activeProgress = getProgress(activeClient?.tasks ?? []);
  const mascotMood = getMascotStateForCurrentClient(activeClient);
  const monthlyGoal = 100;
  const monthlyTons = getMonthlyTons(sales, user?.id);
  const weeklySales = getWeeklySales(sales, user?.id);
  const streak = getSalesStreak(sales, user?.id);
  const monthlyProgress = getMonthlyGoal(monthlyTons, monthlyGoal);
  const progressPercent = monthlyProgress.fill;
  const mascotImagesForSkin = profile?.equipped_skin === 'skeleton'
    ? { sad: '/skins/skeleton/sad.png', neutral: '/skins/skeleton/serious.png', happy: '/skins/skeleton/happy.png' }
    : mascotImages;

  const welcome = el('div', 'advisor-welcome');
  welcome.append(el('h1', '', `¡Hola, ${profile.full_name}!`), el('p', '', new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })));
  page.append(welcome);
  const hero = el('section', 'advisor-hero');
  const ring = advisorProgressRing(portfolio.percentage, `${portfolio.completed} de ${portfolio.total} tareas completadas`, 'advisor-progress-ring');
  ring.querySelector('.ring-copy > span').replaceChildren(
    el('span', 'ring-task-count', `${portfolio.completed} de ${portfolio.total} tareas`),
    el('span', 'ring-task-caption', 'completadas'),
  );
  const heroCopy = el('div', 'advisor-hero-copy');
  const progressLabel = el('h2', 'advisor-kicker', 'Tu avance de cartera');
  heroCopy.append(progressLabel);
  const heroStats = el('div', 'hero-highlight-stats');
  const streakStat = el('div', 'hero-highlight');
  const flame = el('span', 'hero-highlight-icon'); flame.innerHTML = advisorIcon('flame');
  streakStat.append(flame, el('span', '', 'Racha actual'), el('strong', '', `${streak} ${streak === 1 ? 'día' : 'días'}`));
  const salesStat = el('div', 'hero-highlight');
  const salesIcon = el('span', 'hero-highlight-icon'); salesIcon.innerHTML = advisorIcon('sales');
  salesStat.append(salesIcon, el('span', '', 'Ventas confirmadas'), el('strong', '', String(ownConfirmedSales.length)));
  heroStats.append(streakStat, salesStat);
  heroCopy.append(heroStats, button('Ver mis tareas hoy', 'hero-cta', () => document.querySelector('#advisor-actions')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })));
  const mascot = el('div', 'mascot advisor-hero-mascot');
  const mascotImage = el('img', 'mascot-image');
  mascotImage.src = mascotImagesForSkin[mascotMood];
  mascotImage.alt = `Mascota: ${mascotLabels[mascotMood]}`;
  mascot.append(mascotImage);
  hero.append(ring, heroCopy, mascot);
  page.append(hero);

  page.append(metrics([
    ['Clientes actuales', currentClients.length, 'con acciones pendientes', currentClients.length],
    ['Toneladas vendidas', `${ownTons.toLocaleString('es-CO')} t`, 'volumen confirmado', ownTons],
    ['Ventas confirmadas', ownConfirmedSales.length, 'cierres registrados', ownConfirmedSales.length],
    ['Posición global', ownRanking ? `#${ownRanking.position}` : '—', 'ranking comercial'],
  ], true));

  const overview = el('div', 'advisor-overview');
  const leftColumn = el('div', 'advisor-dashboard-column');
  const rightColumn = el('div', 'advisor-dashboard-column');
  leftColumn.append(rankingSection(true));
  overview.append(leftColumn, rightColumn);
  page.append(overview);
  const panel = el('section', 'advisor-client-panel');
  panel.id = 'advisor-actions';
  panel.append(el('h2', 'section-title', 'Clientes actuales pendientes'), el('p', 'muted', 'Mantén el ritmo con las tareas y ventas pendientes de confirmar.'));
  if (!activeClient) {
    const empty = el('div', 'advisor-empty');
    const illustration = el('div', 'advisor-empty-illustration');
    illustration.setAttribute('aria-hidden', 'true');
    const icon = el('span', 'advisor-empty-icon'); icon.innerHTML = advisorIcon('clients');
    illustration.append(icon, el('span', 'advisor-empty-plus', '+'));
    const request = el('button', 'request-client-button', 'Solicitar un cliente');
    request.type = 'button'; request.disabled = true;
    request.title = 'Próximamente. Esta opción todavía no envía avisos.';
    request.setAttribute('aria-describedby', 'request-client-hint');
    const hint = el('p', 'advisor-empty-hint', 'Próximamente · Esta opción aún no envía avisos.');
    hint.id = 'request-client-hint';
    empty.append(illustration, el('h3', '', clients.length ? 'No tienes clientes actuales pendientes' : 'Tu próxima oportunidad empieza aquí'),
      el('p', 'muted', clients.length ? 'Tus clientes con venta confirmada están en Historial de clientes.' : 'Aún no tienes clientes asignados. El administrador puede asignarte uno para empezar tu ruta comercial.'), request, hint);
    panel.append(empty);
    rightColumn.append(panel);
  } else {
    const rail = el('div', 'customer-rail');
    if (currentClients.length === 1) panel.classList.add('single-client');
  const list = el('ul', 'customer-list');
  for (const client of currentClients) {
    const item = el('li');
    const control = button('', `customer-option${client.id === selectedId ? ' selected' : ''}`, () => { selectedId = client.id; aiRecommendation = ''; saleNotice = ''; render(); });
    control.setAttribute('aria-pressed', String(client.id === selectedId));
    const location = client.city && client.department ? ` · ${client.city}, ${client.department}` : '';
    control.append(el('strong', '', client.name), el('span', 'muted', `${client.type}${location} · ${client.tasks.filter(task => !task.completed).length} pendientes`));
    item.append(control); list.append(item);
  }
  rail.append(list); panel.append(rail);
  const detail = el('div', 'customer-detail');
  const clientHead = el('div', 'action-client-head');
  clientHead.append(el('span', 'customer-type', activeClient.type), el('h3', 'participant-name', activeClient.name));
  const actionProgress = el('span', 'action-progress', `${activeProgress.completed}/${activeProgress.total} completadas`);
  clientHead.append(actionProgress); detail.append(clientHead);
  if (saleNotice) detail.append(el('p', 'sale-notice', saleNotice));
  const taskList = el('ol', 'task-list action-task-list');
  for (const task of activeClient.tasks) {
    const item = el('li', 'task'), content = el('div', 'task-content'), actions = el('div', 'task-actions');
    const taskIcon = el('span', 'action-task-icon');
    taskIcon.innerHTML = advisorIcon(['clients', 'phone', 'document', 'target'][taskOrder.indexOf(task.title)] || 'tasks');
    item.append(taskIcon);
    content.append(el('h3', '', task.title), el('p', 'task-description', task.description));
    if (task.completed) {
      const completed = el('span', 'task-completed', 'Completado');
      const check = el('span', 'task-completed-icon'); check.innerHTML = advisorIcon('check');
      completed.prepend(check); actions.append(completed);
    }
    if (!task.completed) actions.append(button('Completar tarea', 'task-complete-button', async event => {
      const control = event.currentTarget; control.disabled = true; control.textContent = 'Guardando…';
      const bounds = control.getBoundingClientRect();
      const origin = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      const progressBefore = getProgress(activeClient.tasks);
      const wasLastTask = progressBefore.isLastTaskPending;
      const result = await db.rpc('complete_mvp_task', { target_task: task.id });
      if (!isTaskCompletionConfirmed(result)) {
        control.disabled = false; control.textContent = 'Completar tarea';
        notice(result?.error?.message || 'La tarea ya fue actualizada. Recarga los datos.', true); return;
      }
      saleNotice = wasLastTask ? 'Las cuatro tareas están completas. Confirma la venta para registrarla.' : '';
      await refresh('');
      const completedTasks = progressBefore.completed + 1;
      if (selectedId === activeClient.id && document.querySelector('.advisor-page')) {
        celebrateTask(origin);
        showMascotFeedback('task', completedTasks);
      }
    }));
    item.append(content, actions); taskList.append(item);
  }
  detail.append(taskList);
  const saleState = getClientSaleState(activeClient, sales);
  if (saleState !== 'pending') detail.append(el('p', 'client-complete-note', saleState === 'confirmed' ? 'Venta confirmada. Tus resultados ya están registrados.' : '¡Todo al día! Ya puedes confirmar esta venta.'));
  if (activeProgress.total === 4 && activeProgress.completed === 4) {
    const confirmed = sales.some(sale => sale.client_id === activeClient.id && sale.confirmed);
    const saleActions = el('div', 'sale-actions');
    if (!confirmed) saleActions.append(button('Confirmar venta', 'primary confirm-sale-button', () => confirmSale(activeClient)));
    saleActions.append(button('Limpiar tareas', 'secondary clear-tasks-button', () => clearCompletedTasks(activeClient)));
    detail.append(saleActions);
  }
  const assistant = el('div', 'action-assistant');
  const assistantHeading = el('div', 'assistant-heading');
  const assistantIcon = el('span', 'assistant-heading-icon'); assistantIcon.innerHTML = advisorIcon('sparkles');
  const assistantCopy = el('div', 'assistant-heading-copy');
  assistantCopy.append(el('strong', '', 'Trompín'), el('span', '', 'Tu asistente comercial'));
  assistantHeading.append(assistantIcon, assistantCopy);
  const resultBox = el('div', 'assistant-result');
  resultBox.setAttribute('role', 'status'); resultBox.setAttribute('aria-live', 'polite');
  resultBox.hidden = !aiRecommendation;
  const resultHeading = el('div', 'assistant-result-heading');
  const resultIcon = el('span', 'assistant-result-icon'); resultIcon.innerHTML = advisorIcon('sparkles');
  resultHeading.append(resultIcon, el('strong', '', 'Tu siguiente paso'));
  resultBox.append(resultHeading, el('p', 'assistant-result-text', aiRecommendation));
  assistant.append(assistantHeading, button('Sugerir siguiente acción', 'assistant-button', event => requestRecommendation(activeClient, event.currentTarget)), resultBox);
  detail.append(assistant);
  panel.append(detail); rightColumn.append(panel);
  }

  const goalCard = el('section', 'tonnage-goal-card');
  goalCard.append(el('h2', '', 'Meta mensual de toneladas'), el('p', 'muted', 'Tu avance de toneladas de cemento este mes.'));
  const goalBody = el('div', 'monthly-goal-body');
  const goalDetails = el('div', 'monthly-goal-details');
  const goalRing = advisorProgressRing(monthlyProgress.percentage, 'completado', 'monthly-goal-ring');
  const tonnageValue = el('div', 'tonnage-value');
  tonnageValue.append(el('strong', '', monthlyTons.toLocaleString('es-CO')), el('span', '', `de ${monthlyGoal} t`));
  const tonnageTrack = el('div', 'tonnage-track');
  tonnageTrack.setAttribute('role', 'progressbar'); tonnageTrack.setAttribute('aria-label', 'Meta mensual de toneladas'); tonnageTrack.setAttribute('aria-valuemin', '0'); tonnageTrack.setAttribute('aria-valuemax', String(monthlyGoal)); tonnageTrack.setAttribute('aria-valuenow', String(Math.min(monthlyTons, monthlyGoal))); tonnageTrack.setAttribute('aria-valuetext', `${monthlyTons} de ${monthlyGoal} toneladas, ${monthlyProgress.percentage}% de la meta`);
  const tonnageFill = el('span'); tonnageFill.style.width = `${progressPercent}%`; tonnageTrack.append(tonnageFill);
  goalDetails.append(tonnageValue, tonnageTrack, el('p', 'muted', `${monthlyProgress.percentage}% de tu meta mensual`));
  goalBody.append(goalRing, goalDetails); goalCard.append(goalBody);

  const portfolioCard = el('section', 'portfolio-card');
  portfolioCard.append(el('h2', '', 'Avance de tu cartera'), el('p', 'muted', 'Cada tarea te acerca a tu próxima venta.'));
  const portfolioBody = el('div', 'portfolio-body');
  portfolioBody.append(advisorProgressRing(portfolio.percentage, 'completado', 'portfolio-ring'));
  const portfolioDetails = el('div', 'portfolio-details');
  portfolioDetails.append(el('strong', '', `${portfolio.completed} de ${portfolio.total} tareas completadas`), el('p', 'muted', portfolio.total ? 'Progreso de tus clientes asignados.' : 'Aún no tienes tareas asignadas.'));
  const ready = el('p', 'portfolio-ready', `${portfolio.readyClients} ${portfolio.readyClients === 1 ? 'cliente listo' : 'clientes listos'} para confirmar venta`);
  portfolioDetails.append(ready); portfolioBody.append(portfolioDetails); portfolioCard.append(portfolioBody);

  const weeklyCard = el('section', 'weekly-sales-card');
  weeklyCard.append(el('h2', '', 'Ventas de la semana'), el('p', 'muted', 'Número de ventas confirmadas por día.'));
  const chart = el('div', 'weekly-chart');
  const maxWeeklySales = Math.max(1, ...weeklySales.map(day => day.count));
  for (const day of weeklySales) {
    const column = el('div', 'weekly-chart-column');
    const bar = el('span', 'weekly-chart-bar');
    bar.style.height = `${day.count ? Math.max(16, Math.round((day.count / maxWeeklySales) * 100)) : 4}%`;
    bar.title = `${day.label}: ${day.count} ventas`;
    column.append(el('strong', '', String(day.count)), bar, el('span', '', day.label));
    chart.append(column);
  }
  weeklyCard.append(chart, el('p', 'muted', `${weeklySales.reduce((total, day) => total + day.count, 0)} ventas registradas esta semana`));
  leftColumn.append(goalCard, portfolioCard); rightColumn.append(weeklyCard);
  for (const [card, name] of [[leftColumn.firstChild, 'trophy'], [panel, 'tasks'], [goalCard, 'target'], [portfolioCard, 'clients'], [weeklyCard, 'sales']]) {
    const icon = el('span', 'dashboard-heading-icon'); icon.innerHTML = advisorIcon(name); card.querySelector('h2').prepend(icon);
  }
}

function advisorProgressRing(percentage, label, className) {
  const ring = el('div', className);
  ring.setAttribute('role', 'img');
  ring.setAttribute('aria-label', `${percentage}% · ${label}`);
  ring.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="ring-track" cx="50" cy="50" r="42"/><circle class="ring-fill" cx="50" cy="50" r="42" pathLength="100" stroke-dasharray="${Math.min(100, percentage)} 100"/></svg>`;
  const copy = el('div', 'ring-copy'); copy.append(el('strong', '', `${percentage}%`), el('span', '', label)); ring.append(copy);
  return ring;
}
async function confirmSale(client) {
  const result = await db.rpc('confirm_mvp_sale', { target_client: client.id });
  if (result.error) { notice(result.error.message, true); return; }
  saleNotice = '';
  await refresh('');
  if (document.querySelector('.advisor-page')) {
    celebrateSale();
    showMascotFeedback('sale');
  }
}
async function refresh(text) {
  try { await loadData(); render(); notice(text); }
  catch (cause) { notice(`El cambio se guardó, pero no se pudo actualizar la vista: ${cause.message}`, true); }
}
function render() {
  advisorMapModule?.destroyAdvisorClientMap();
  clearProfileEntrance(!profile || profile.role !== 'advisor' || advisorView !== 'profile');
  shell();
  const page = document.querySelector('#page');
  if (!db) page.replaceChildren(el('p', 'empty-state', 'Falta configurar Supabase en .env.local.'));
  else if (!profile) authPage();
  else if (profile.role === 'admin' && adminView === 'shop') renderShop(page, sales.filter(sale => sale.confirmed).length, halloweenReady && halloweenEnabled, profile.equipped_skin, equipSkin);
  else if (profile.role === 'admin') adminPage(page);
  else if (advisorView === 'shop') renderShop(page, sales.filter(sale => sale.advisor_id === user?.id && sale.confirmed).length, halloweenReady && halloweenEnabled, profile.equipped_skin, equipSkin);
  else if (advisorView === 'rewards') renderRewards(page, sales.filter(sale => sale.advisor_id === user?.id && sale.confirmed).length);
  else if (advisorView === 'history') advisorHistoryPage(page);
  else if (advisorView === 'map') advisorMapPage(page);
  else if (advisorView === 'profile') advisorProfilePage(page);
  else {
    advisorPage(page);
    playAdvisorEntrance(root);
  }
  paintHalloween();
  if (profilePhotoPromptPending && profile?.role === 'advisor') openProfilePanel(true);
}
if (db) boot(); else render();
