import './style.css';
import './shop.css';
import './advisor.css';
import './rewards.css';
import './notification-center.css';
import { createNotificationCenter } from './notification-center.js';
import { renderShop, renderHalloweenCollection } from './shop.js';
import { renderRewards } from './rewards.js';
import { playStoreEntrance, resetStoreEntrance } from './store-entrance.js';
import { createClient } from '@supabase/supabase-js';
import { getMascotStateForCurrentClient, getProgress, getXp, getLevelProgress, isTaskCompletionConfirmed } from './game.js';
import { mascotImages, mascotLabels } from './mascot.js';
import { getMonthlyTons, getSalesStreak, getWeeklySales, getRankingSlots, getPortfolioProgress, getMonthlyGoal, getClientSaleState, getClientHistoryStatus, isCurrentClient, getTodaySales, getRankingGap } from './advisor-metrics.js';
import { advisorIcon } from './advisor-icons.js';
import { createZoneList, getZoneOpportunities, loadZoneMarket } from './zone-opportunity.js';
import { clearMascotFeedback, showMascotFeedback, showMascotLine } from './mascot-feedback.js';
import { clearAdvisorEntrance, playAdvisorEntrance, resetAdvisorEntrance } from './advisor-entrance.js';
import { animateSidebar, resetSidebarMotion } from './advisor-sidebar.js';
import { bindAdvisorHover } from './advisor-hover.js';
import { clearTopitinToast, showTopitinToast } from './topitin-toast.js';
import { clearAdvisorEffects, celebrateTask, celebrateSale, flipMetric, morphWeeklyChart, revealRecommendation, ringNotificationBell } from './advisor-effects.js';
import { isValidProfileImage, profileImageExtension } from './profile.js';
import { createProfileAvatar, createProfilePhotoPicker, renderAdvisorProfile, playProfileEntrance, clearProfileEntrance } from './profile-view.js';
import { showLoadingScreen, clearLoadingScreen } from './loading-screen.js';
import { attachRankingAvatars } from './ranking-avatars.js';
import { COLOMBIA_DEPARTMENTS, citiesForDepartment, normalizeClientLocation } from './client-location.js';
import { commissionSummary, getCommissionStatus } from './commission-wallet.js';
import { getProgressModel, renderProgressPage, showLevelBanner } from './progress-page.js';
import { celebrateCommissionClaim, celebrateCommissionClaimed, commissionGoals, commissionMilestones, commissionStats, commissionTakeHome, playCommissionEntrance, resetCommissionEntrance } from './commission-gamification.js';

const SUPABASE_TIMEOUT_MS = 15000;
// Stalled browser connections must fail fast instead of keeping the loading screen forever.
function supabaseFetch(input, init = {}) {
  const started = performance.now();
  const isUpload = init.body instanceof Blob || init.body instanceof FormData;
  const timeout = isUpload ? null : AbortSignal.timeout(SUPABASE_TIMEOUT_MS);
  const signal = timeout && init.signal ? AbortSignal.any([init.signal, timeout]) : timeout || init.signal;
  return fetch(input, { ...init, signal }).finally(() => {
    const elapsed = Math.round(performance.now() - started);
    if (import.meta.env.DEV && elapsed > 1500) console.warn(`[supabase] ${elapsed} ms`, String(input?.url ?? input).split('?')[0]);
  });
}
const db = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { global: { fetch: supabaseFetch } }) : null;
const root = document.querySelector('#app');
let user = null, profile = null, advisors = [], clients = [], sales = [], ranking = [], notifications = [], selectedId = null, aiRecommendation = '', saleNotice = '';
let theme = localStorage.getItem('ultracem-theme') || 'light';
let advisorView = 'dashboard', adminView = 'dashboard';
let advisorMapModule;
// The 3D world survives re-renders of the Progreso page; it is destroyed when leaving it.
let progressWorld = null, progressWorldRequest = 0, progressLevels = [], progressSelected = null;
let halloweenEnabled = false, halloweenReady = false, halloweenSaving = false, halloweenError = '';
let halloweenTimer = null, halloweenRequest = 0;
let noticeTimer = null;
let profilePhotoPromptPending = false;
let profilePhotoUrlTimer = null;
let profilePhotoSaving = false;
let profileKeyboardNavigation = false;
let notificationChannel = null;
let notificationCenter = null;
const dismissedNotificationIds = new Set();
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
  resetSidebarMotion();
  clearTopitinToast();
  if (notificationChannel) { await db.removeChannel(notificationChannel); notificationChannel = null; }
  stopHalloweenSync();
  window.clearInterval(profilePhotoUrlTimer);
  profilePhotoUrlTimer = null;
  user = profile = null; advisors = clients = sales = ranking = notifications = []; aiRecommendation = ''; saleNotice = ''; advisorView = 'dashboard'; adminView = 'dashboard';
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
// Único acceso al perfil en escritorio: toda la tarjeta abre la vista de perfil.
function advisorProfileCard() {
  const level = getLevelProgress(profile.level, profile.progression_sales);
  const points = Number(profile.points || 0);
  const card = el('section', `advisor-profile-card${advisorView === 'profile' ? ' current' : ''}`);
  const open = button('', 'profile-card-button', event => { profileKeyboardNavigation = event.detail === 0; advisorView = 'profile'; render(); window.scrollTo(0, 0); });
  open.setAttribute('aria-label', `Abrir mi perfil: ${profile.full_name}, Nivel ${level.level}, ${points.toLocaleString('es-CO')} puntos`);
  if (advisorView === 'profile') open.setAttribute('aria-current', 'page');
  const avatar = el('span', 'profile-card-avatar');
  const ring = el('span', 'profile-card-ring');
  ring.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="ring-track" cx="50" cy="50" r="45"/><circle class="ring-fill" cx="50" cy="50" r="45" pathLength="100" stroke-dasharray="${level.percentage} 100"/></svg>`;
  avatar.append(ring, profileAvatar());
  const copy = el('span', 'profile-card-copy');
  const name = el('strong', 'profile-card-name', profile.full_name);
  const meta = el('span', 'profile-card-meta');
  const levelChip = el('span', 'profile-card-level', `Nivel ${level.level}`);
  const balance = el('span', 'profile-card-points');
  const pointsIcon = el('span', 'profile-card-points-icon');
  pointsIcon.setAttribute('aria-hidden', 'true');
  pointsIcon.innerHTML = advisorIcon('sparkles');
  const count = el('b', '', points.toLocaleString('es-CO'));
  count.dataset.sidebarCount = String(points);
  balance.append(pointsIcon, count, el('span', '', 'pts'));
  meta.append(levelChip, balance);
  copy.append(name, meta);
  const arrow = el('span', 'profile-card-arrow');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.innerHTML = advisorIcon('arrow');
  open.append(avatar, copy, arrow);
  const goal = el('p', 'profile-card-goal', level.target ? `${level.sales}/${level.target} ventas para Nivel ${level.level + 1}` : 'Nivel máximo alcanzado');
  goal.setAttribute('aria-hidden', 'true');
  card.append(open, goal);
  return card;
}
function notice(text, error = false) {
  const node = document.querySelector('#notice');
  window.clearTimeout(noticeTimer);
  node.textContent = text;
  node.hidden = !text;
  node.classList.toggle('error-notice', error);
  const successToast = !error && ['Skin equipada.', 'Foto de perfil actualizada.', 'Foto de perfil eliminada.', 'La comisión fue canjeada satisfactoriamente.'].includes(text);
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
async function notifyEmail(eventType, eventId) {
  if (!db || !eventId) return 'No se pudo identificar el evento del correo.';
  try {
    const { data, error } = await db.functions.invoke('send-notification-email', { body: { event_type: eventType, event_id: eventId } });
    if (error) {
      const detail = await error.context?.json?.().catch(() => null);
      return detail?.error || 'No se pudo enviar el correo. Revisa la función de notificaciones.';
    }
    if (data?.error || !Number.isInteger(data?.sent) || data.sent < 1) return data?.error || 'No se confirmó el envío de ningún correo.';
    return null;
  } catch {
    return 'No se pudo conectar con el servicio de correo.';
  }
}
const LOCAL_NOTIFICATION = 'local-';
function withLocalNotifications(list) {
  const local = notifications.filter(item => String(item.id).startsWith(LOCAL_NOTIFICATION) && !dismissedNotificationIds.has(item.id));
  return [...local, ...list.filter(item => !String(item.id).startsWith(LOCAL_NOTIFICATION))].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 20);
}
// Cada toque a Topitín trae una frase distinta; muchos toques seguidos le dan cosquillas.
let pokeTurn = 0, pokeTimes = [], weeklyChartMode = 'sales';
const metricBackFaces = new Set();
function pokeTopitin(client, progress, portfolio, stats) {
  const now = performance.now();
  pokeTimes = [...pokeTimes.filter(time => now - time < 1200), now];
  if (pokeTimes.length >= 4) { pokeTimes = []; showMascotLine('¡Jajaja, me haces cosquillas! Ya, ya… ¡a vender!', 'tickle'); return; }
  const left = progress.total - progress.completed;
  const status = !client ? '¡Venta completada y todo al 100 %! Estoy muy orgulloso de ti. Pide un cliente nuevo cuando quieras.'
    : left > 0 ? `Te ${left === 1 ? 'falta 1 tarea' : `faltan ${left} tareas`} con ${client.name}. ¡Vamos por ${left === 1 ? 'ella' : 'ellas'}!`
    : getClientSaleState(client, sales) === 'ready' ? `¡Las 4 tareas de ${client.name} están listas! Confirma la venta.`
    : `¡Venta de ${client.name} confirmada! Estás al 100 %.`;
  const { salesToday, streak, position, gap, monthlyPercent, level } = stats;
  const lines = [
    status,
    `Vas en el ${monthlyPercent} % de tu meta mensual de toneladas. ¡Dale!`,
    'Psst… tengo un secreto. Revisa tus notificaciones.',
    salesToday ? `¡Hoy ya ${salesToday === 1 ? 'cerraste 1 venta' : `cerraste ${salesToday} ventas`}! Eso merece un bailecito.` : 'Hoy aún no hay ventas… ¡la primera del día sabe mejor!',
    position === 1 ? '¡Eres el #1 del ranking! Que no te alcancen.' : gap ? `Te ${gap.value === 1 ? 'falta 1 venta' : `faltan ${gap.value} ventas`} para subir al #${gap.target}.` : 'Cada venta confirmada te sube en el ranking.',
    'Consejo: una llamada de seguimiento a tiempo vale más que diez correos.',
    streak > 1 ? `¡Llevas ${streak} días seguidos vendiendo! No rompamos la racha.` : 'Si vendes hoy y mañana, empezamos una racha juntos.',
    level.target ? `Te ${level.target - level.sales === 1 ? 'falta 1 venta' : `faltan ${level.target - level.sales} ventas`} para el Nivel ${level.level + 1}.` : '¡Ya estás en el nivel máximo! Eres leyenda.',
    'Consejo: confirma la venta apenas termines las 4 tareas y sumas puntos al instante.',
    '¿Sabías que en la tienda puedes cambiarme de traje? Me veo genial de esqueleto.',
    'Estira la espalda, toma agua y seguimos. ¡Yo te echo porras!',
    `Llevas el ${portfolio.percentage} % de tus tareas. ¡Sigue así!`,
  ];
  const line = lines[pokeTurn % lines.length];
  pokeTurn++;
  showMascotLine(line);
  if (line.startsWith('Psst')) revealCommissionSecret();
}
const skinHappyImage = () => profile?.equipped_skin === 'skeleton' ? '/skins/skeleton/happy.png' : mascotImages.happy;
// Easter egg: tocar a Topitín en Inicio deja una pista en las notificaciones.
function revealCommissionSecret() {
  const id = `${LOCAL_NOTIFICATION}commission-secret`;
  dismissedNotificationIds.delete(id);
  if (!notifications.some(item => item.id === id && !item.read_at)) {
    notifications = [{ id, kind: 'commission_secret', title: 'Topitín te cuenta un secreto', body: 'En tu Cartera de comisiones, toca 5 veces seguidas «Total neto canjeado» y mira qué pasa.', created_at: new Date().toISOString(), read_at: null }, ...notifications.filter(item => item.id !== id)];
    notificationCenter?.update(notifications);
  }
  ringNotificationBell();
}
async function markNotificationsRead(notification) {
  if (notification.read_at) return;
  // Las notificaciones locales (easter eggs) no existen en Supabase.
  if (String(notification.id).startsWith('local-')) {
    notifications = notifications.map(item => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item);
    return;
  }
  if (profile.role === 'admin' && notification.kind === 'client_request' && notification.related_request_id) {
    const requestResult = await db.from('mvp_client_requests').select('status').eq('id', notification.related_request_id).single();
    if (requestResult.error) throw new Error('No se pudo comprobar el estado de la solicitud.');
    if (requestResult.data?.status !== 'handled') throw new Error('Asigna el cliente antes de marcar esta solicitud como leída.');
  }
  const result = await db.rpc('mark_mvp_notification_read', { target_notification: notification.id });
  if (result.error) throw result.error;
  notifications = notifications.map(item => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item);
}
function clearReadNotifications() {
  for (const notification of notifications) if (notification.read_at) dismissedNotificationIds.add(notification.id);
  notifications = notifications.filter(notification => !dismissedNotificationIds.has(notification.id));
  notificationCenter?.update(notifications);
}
async function openNotification(notification) {
  if (notification.kind === 'commission_secret') {
    advisorView = 'commissions';
    render();
    window.scrollTo(0, 0);
    document.querySelector('.commission-takehome')?.focus({ preventScroll: true });
    return;
  }
  if (profile.role === 'admin' && notification.kind === 'client_request') {
    const result = await db.from('mvp_client_requests').select('advisor_id').eq('id', notification.related_request_id).single();
    if (result.error) throw result.error;
    if (!advisors.some(item => item.user_id === result.data.advisor_id)) throw new Error('El asesor ya no está disponible.');
    adminView = 'dashboard';
    render();
    document.querySelector('#notification-assigned-advisor').value = result.data.advisor_id;
    const form = document.querySelector('#admin-client-form');
    form.scrollIntoView({ block: 'center' });
    form.querySelector('input').focus({ preventScroll: true });
  } else if (profile.role === 'advisor' && notification.kind === 'client_assigned') {
    await loadData();
    selectedId = notification.related_client_id;
    advisorView = 'dashboard';
    render();
    const target = document.querySelector('#advisor-actions') || document.querySelector('#page h1');
    if (target) { target.tabIndex = -1; target.scrollIntoView({ block: 'start' }); target.focus({ preventScroll: true }); }
  }
}
function startNotificationSync() {
  if (!db || !user) return;
  if (notificationChannel) db.removeChannel(notificationChannel);
  notificationChannel = db.channel(`mvp-notifications-${user.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mvp_notifications', filter: `recipient_id=eq.${user.id}` }, payload => {
      if (notifications.some(item => item.id === payload.new.id)) return;
      notifications = [payload.new, ...notifications].slice(0, 20);
      notificationCenter?.update(notifications);
      notice(`${payload.new.title}: ${payload.new.body}`);
      if (profile.role === 'advisor' && payload.new.kind === 'client_assigned') {
        void openNotification(payload.new).catch(() => notice('No se pudieron cargar las próximas acciones.', true));
      }
    })
    .subscribe();
}
function shell() {
  notificationCenter?.destroy();
  notificationCenter = null;
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
      if (view === 'shop' || view === 'rewards') refreshHalloween();
      if (view === 'progress') void refreshProgress();
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
    const mobileLabels = { dashboard: 'Inicio', history: 'Clientes', commissions: 'Comisiones', map: 'Mapa', shop: 'Cosméticos', rewards: 'Premios', progress: 'Progreso', profile: 'Perfil' };
    for (const [view, label, icon] of [['dashboard', 'Inicio', 'home'], ['commissions', 'Cartera de comisiones', 'sales'], ['map', 'Mapa clientela', 'map'], ['shop', 'Tienda cosméticos', 'shop'], ['rewards', 'Premios', 'gift'], ['progress', 'Progreso', 'flag'], ['profile', 'Perfil', 'profile']]) {
      // En escritorio el perfil vive en la tarjeta inferior; en móvil sigue en la barra.
      for (const [container, className] of view === 'profile' ? [[mobileNav, '']] : [[nav, 'sidebar-item'], [mobileNav, '']]) {
        const control = button(container === mobileNav ? mobileLabels[view] : label, className, event => navigate(view, event));
        if (container === mobileNav) control.setAttribute('aria-label', label);
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
    // Fuera de <main> para que ninguna animación de la página afecte la barra fija.
    root.append(mobileNav);
    animateSidebar(sidebar);
  } else if (profile?.role === 'admin') {
    const sidebar = root.querySelector('.app-sidebar');
    const nav = sidebar.querySelector('.sidebar-nav');
    const navigate = view => { adminView = view; render(); window.scrollTo(0, 0); };
    nav.setAttribute('aria-label', 'Portal de administración');
    for (const [view, label, icon] of [['dashboard', 'Tablero de admin', '01'], ['shop', 'Tienda cosméticos', '02']]) {
      const control = button(label, 'sidebar-item', () => navigate(view));
      control.prepend(el('b', '', icon));
      if (adminView === view) { control.classList.add('active'); control.setAttribute('aria-current', 'page'); }
      nav.append(control);
    }
  }
  if (profile) {
    const actions = document.querySelector('#actions');
    if (profile.role === 'admin') actions.append(el('span', 'session-name', `${profile.full_name} · Administrador`));
    else {
      const mobilePoints = el('span', 'advisor-mobile-points');
      const mobilePointsIcon = el('span', 'advisor-mobile-points-icon');
      mobilePointsIcon.setAttribute('aria-hidden', 'true');
      mobilePointsIcon.innerHTML = advisorIcon('sparkles');
      mobilePoints.append(mobilePointsIcon, el('strong', '', Number(profile.points || 0).toLocaleString('es-CO')), el('span', '', 'puntos'));
      actions.append(mobilePoints);
    }
    notificationCenter = createNotificationCenter(root, {
      role: profile.role, notifications, onRead: markNotificationsRead, onAction: openNotification,
      onClearRead: clearReadNotifications,
      onRefresh: async () => {
        const recipientId = user.id;
        const result = await db.from('mvp_notifications').select('id,recipient_id,kind,title,body,related_request_id,related_client_id,created_at,read_at').eq('recipient_id', recipientId).order('created_at', { ascending: false }).limit(20);
        if (result.error) throw result.error;
        if (user?.id !== recipientId) throw new Error('La sesión cambió.');
        // Retain realtime inserts that arrive while this snapshot is in flight.
        const merged = new Map((result.data ?? []).filter(item => !dismissedNotificationIds.has(item.id)).map(item => [item.id, item]));
        for (const item of notifications) {
          const saved = merged.get(item.id);
          if (!saved) merged.set(item.id, item);
          else if (item.read_at && !saved.read_at) merged.set(item.id, { ...saved, read_at: item.read_at });
        }
        notifications = [...merged.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 20);
        return notifications;
      },
    });
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
  let own = await db.from('mvp_profiles').select('user_id,full_name,role,equipped_skin,avatar_path,photo_prompted_at,points,level,progression_sales').eq('user_id', user.id).single();
  if (own.error && /avatar_path|photo_prompted_at|points|level|progression_sales|column/i.test(own.error.message || '')) {
    own = await db.from('mvp_profiles').select('user_id,full_name,role,equipped_skin').eq('user_id', user.id).single();
    if (!own.error) Object.assign(own.data, { photo_prompted_at: new Date().toISOString(), points: 0, level: 1, progression_sales: 0 });
  }
  if (own.error) throw own.error;
  profile = own.data;
  profile.avatar_url = '';
  profilePhotoPromptPending = profile.role === 'advisor' && !profile.photo_prompted_at;
  // Independent queries run together; each one was a full round trip when awaited in sequence.
  const [signed, ...loaded] = await Promise.all([
    profile.avatar_path ? db.storage.from('advisor-profile-photos').createSignedUrl(profile.avatar_path, 3600) : null,
    ...fullResources().map(name => resourceLoaders[name]()),
  ]);
  profile.avatar_url = signed?.data?.signedUrl || '';
  fullResources().forEach((name, index) => applyResource(name, loaded[index]));
  ranking = await attachRankingAvatars(db, ranking, profile);
  scheduleProfilePhotoUrlRefresh();
}
function fullResources() {
  return ['advisors', 'clients', 'sales', 'notifications', 'ranking'];
}
// One loader per resource so an action can reload only what it changed.
const resourceLoaders = {
  async stats() {
    const result = await db.from('mvp_profiles').select('points,level,progression_sales').eq('user_id', user.id).single();
    if (result.error) throw result.error;
    return result.data;
  },
  async advisors() {
    if (profile.role !== 'admin') return [];
    const list = await db.rpc('get_mvp_advisors');
    if (list.error) throw list.error;
    return (list.data ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name));
  },
  async clients() {
    const result = await db.from('mvp_clients').select('id,name,type,advisor_id,department,city,tons_requested,mvp_tasks(id,title,description,completed_at)').order('created_at', { ascending: false });
    if (result.error) throw result.error;
    return result.data.map(client => ({
      ...client,
      tasks: client.mvp_tasks
        .map(task => ({ ...task, completed: Boolean(task.completed_at) }))
        .sort((a, b) => {
          const aIndex = taskOrder.indexOf(a.title);
          const bIndex = taskOrder.indexOf(b.title);
          return (aIndex < 0 ? taskOrder.length : aIndex) - (bIndex < 0 ? taskOrder.length : bIndex);
        }),
    }));
  },
  async sales() {
    const result = await db.from('mvp_sales').select('id,client_id,advisor_id,amount,tons_sold,completed_at,confirmed,confirmed_at,commission_price_per_ton,commission_rate,commission_amount,commission_status,commission_claimed_at');
    if (result.error) throw result.error;
    return result.data ?? [];
  },
  async notifications() {
    const result = await db.from('mvp_notifications').select('id,recipient_id,kind,title,body,related_request_id,related_client_id,created_at,read_at').order('created_at', { ascending: false }).limit(20);
    if (result.error && !/relation .*mvp_notifications.* does not exist|could not find the table/i.test(result.error.message || '')) throw result.error;
    return (result.data ?? []).filter(item => !dismissedNotificationIds.has(item.id));
  },
  async ranking() {
    const result = await db.rpc('get_mvp_advisor_ranking');
    if (result.error) throw result.error;
    return result.data ?? [];
  },
};
function applyResource(name, value) {
  if (name === 'stats') Object.assign(profile, value);
  else if (name === 'advisors') advisors = value;
  else if (name === 'clients') {
    clients = value;
    if (!clients.some(client => client.id === selectedId)) selectedId = clients[0]?.id ?? null;
  } else if (name === 'sales') sales = value;
  else if (name === 'notifications') notifications = withLocalNotifications(value);
  // Partial reloads keep the photos already signed instead of re-signing every avatar.
  else if (name === 'ranking') ranking = value.map(row => ({ ...row, avatar_url: ranking.find(item => item.advisor_id === row.advisor_id)?.avatar_url || '' }));
}
let pendingWrites = 0, effectsUntil = 0, reconcileTimer = null;
const staleResources = new Set();
function viewSignature() {
  // Day precision: the view only shows dates, and client clocks never match server now().
  return JSON.stringify([profile, clients, sales, ranking], (key, value) => key.endsWith('_at') && typeof value === 'string' ? value.slice(0, 10) : key === 'avatar_url' ? undefined : value);
}
function renderWhenIdle() {
  window.clearTimeout(reconcileTimer);
  // A full render clears confetti and mascot feedback, so server corrections wait for them.
  const wait = effectsUntil - performance.now();
  if (wait > 0) reconcileTimer = window.setTimeout(renderWhenIdle, wait);
  else render();
}
// Background confirmation after a write; applied only once no other optimistic write is in flight.
async function reloadResources(names) {
  for (const name of names) staleResources.add(name);
  if (pendingWrites) return;
  const viewer = user?.id, requested = [...staleResources];
  staleResources.clear();
  const started = performance.now();
  try {
    const values = await Promise.all(requested.map(name => resourceLoaders[name]()));
    if (user?.id !== viewer || !profile) return;
    if (pendingWrites) { for (const name of requested) staleResources.add(name); return; }
    const before = viewSignature();
    requested.forEach((name, index) => applyResource(name, values[index]));
    if (viewSignature() !== before) renderWhenIdle();
    else notificationCenter?.update(notifications);
  } catch {
    for (const name of requested) staleResources.add(name);
  } finally {
    measureAction(`reload ${requested.join('+')}`, started);
  }
}
function measureAction(label, started) {
  const duration = Math.round(performance.now() - started);
  performance.measure?.(`ultracem: ${label}`, { start: started, duration });
  if (import.meta.env.DEV) console.debug(`[ultracem] ${label}: ${duration} ms`);
}
// Shows a change right away, confirms it with Supabase and undoes only this change if the write fails.
async function optimisticWrite({ label, apply, revert, write, reload }) {
  const started = performance.now();
  pendingWrites++;
  apply();
  render();
  playQueuedEffect();
  measureAction(`${label} (visible)`, started);
  let result;
  try { result = await write(); } catch (cause) { result = { error: cause }; }
  pendingWrites--;
  measureAction(`${label} (saved)`, started);
  if (result?.error) {
    revert();
    render();
    notice(result.error.message || 'No se pudo guardar el cambio. Intenta de nuevo.', true);
    void reloadResources(reload);
    return null;
  }
  void reloadResources(reload);
  return result;
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
    if (typeof startNotificationSync === 'function') startNotificationSync();
    render();
    halloweenTimer = window.setInterval(() => {
      if (!document.hidden && (profile?.role === 'admin' || advisorView === 'shop' || advisorView === 'rewards')) refreshHalloween();
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
  // Premios se vuelve a dibujar solo si el interruptor del admin cambió desde el último render.
  const rewardsPage = document.querySelector('.rewards-page');
  if (rewardsPage && rewardsPage.dataset.halloween !== String(halloweenReady && halloweenEnabled)) { render(); return; }
  const control = document.querySelector('#halloween-toggle');
  if (control) {
    control.disabled = !halloweenReady || halloweenSaving;
    control.textContent = halloweenSaving ? 'Guardando…' : halloweenEnabled ? 'Desactivar Halloween' : 'Activar Halloween';
    control.setAttribute('aria-pressed', String(halloweenEnabled));
    document.querySelector('#halloween-status').textContent = halloweenError || `Modo Halloween ${halloweenEnabled ? 'activado' : 'desactivado'}.`;
  }
  const page = document.querySelector('.shop-page');
  if (page) {
    renderHalloweenCollection(page, halloweenReady && halloweenEnabled, profile?.equipped_skin, ranking.find(row => row.advisor_id === user?.id)?.confirmed_sales ?? 0, equipSkin, profile?.points);
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
  for (const [index, [label, value, note, countTarget, unit, flip]] of items.entries()) {
    const item = el(flip ? 'button' : 'div', flip ? 'metric metric-flip' : 'metric');
    if (advisor) {
      const icon = el('span', 'metric-icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = advisorIcon(['clients', 'truck', 'sales', 'trophy'][index]);
      item.append(icon);
    }
    const valueNode = el('strong', 'metric-value');
    const number = el('span', 'metric-number', String(value));
    valueNode.append(number);
    // La unidad va aparte para que el contador animado solo cambie el número.
    if (unit) valueNode.append(el('small', 'metric-unit', unit));
    item.append(el('span', 'metric-label', label), valueNode, el('span', 'metric-note', note));
    if (advisor && Number.isFinite(countTarget)) number.dataset.countTarget = String(countTarget);
    if (flip) makeFlipMetric(item, { label, value, unit, count: countTarget }, flip);
    row.append(item);
  }
  return row;
}
// Métrica con dos caras (p. ej. clientes actuales ⇄ totales): un clic la voltea.
function makeFlipMetric(item, front, { back, name }) {
  item.type = 'button';
  const hint = el('span', 'metric-flip-hint');
  hint.setAttribute('aria-hidden', 'true');
  hint.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4M3 8h13a4 4 0 0 1 4 4M17 20l4-4-4-4M21 16H8a4 4 0 0 1-4-4"/></svg>';
  item.append(hint);
  let side = metricBackFaces.has(name) ? 1 : 0;
  const paint = () => {
    const face = side ? back : front;
    item.querySelector('.metric-label').textContent = face.label;
    const number = item.querySelector('.metric-number');
    number.textContent = String(face.value);
    if (Number.isFinite(face.count)) number.dataset.countTarget = String(face.count);
    else delete number.dataset.countTarget;
    let unitNode = item.querySelector('.metric-unit');
    if (face.unit && !unitNode) { unitNode = el('small', 'metric-unit'); item.querySelector('.metric-value').append(unitNode); }
    if (unitNode) { unitNode.textContent = face.unit || ''; unitNode.hidden = !face.unit; }
    item.setAttribute('aria-pressed', String(Boolean(side)));
    item.setAttribute('aria-label', `${face.label}: ${face.value}${face.unit ? ` ${face.unit.toLowerCase()}` : ''}. Toca para ver ${(side ? front : back).label.toLowerCase()}.`);
  };
  paint();
  item.addEventListener('click', () => {
    side = 1 - side;
    if (side) metricBackFaces.add(name); else metricBackFaces.delete(name);
    flipMetric(item, paint);
  });
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
  const confirmed = window.confirm('¿Borrar los ' + clientCount + ' clientes de ' + advisor.full_name + '? También se eliminarán sus tareas y ventas, y sus puntos y nivel volverán a cero. Esta acción no se puede deshacer.');
  if (!confirmed) return;
  const result = await db.rpc('delete_mvp_advisor_clients', { target_advisor: advisor.user_id });
  if (result.error) {
    notice(result.error.message, true);
    return;
  }
  await refresh('Clientes de ' + advisor.full_name + ' eliminados y puntos reiniciados.');
}
async function resetAdvisorProgress(advisor) {
  const confirmed = window.confirm('¿Reiniciar los puntos de ' + advisor.full_name + '? Su nivel volverá a 1 y sus ventas acumuladas a 0. Los clientes y las comisiones se conservan. Esta acción no se puede deshacer.');
  if (!confirmed) return;
  const result = await db.rpc('reset_mvp_advisor_progress', { target_advisor: advisor.user_id });
  if (result.error) {
    notice(result.error.message, true);
    return;
  }
  await refresh('Puntos de ' + advisor.full_name + ' reiniciados.');
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
  const previous = clients.find(item => item.id === client.id);
  if (!previous) return;
  const replace = next => { clients = clients.map(item => item.id === client.id ? next : item); };
  const result = await optimisticWrite({
    label: 'limpiar tareas',
    apply: () => replace({ ...previous, tasks: previous.tasks.filter(task => !task.completed) }),
    revert: () => replace(previous),
    write: () => db.rpc('clear_mvp_completed_tasks', { target_client: client.id }),
    reload: ['clients'],
  });
  if (result) notice('Tareas completadas de ' + client.name + ' limpiadas. Las métricas se conservaron.');
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
    actions.append(button('Reiniciar puntos', 'danger-button', () => resetAdvisorProgress(advisor)));
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
  form.id = 'admin-client-form';
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
  advisor.id = 'notification-assigned-advisor';
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
    const result = await db.rpc('assign_mvp_client', { client_name: name.value.trim(), client_type: type.value, target_advisor: advisor.value, target_department: location.department, target_city: location.city, requested_tons: requestedTons });
    if (result.error) { error.textContent = result.error.message; submit.disabled = false; submit.textContent = 'Crear cliente y tareas'; return; }
    await refresh('Cliente creado con cuatro tareas.');
    notice('Cliente guardado. 🐧 Topitín ya avisó al asesor y dejó su nueva misión lista en el sistema.');
  });
  manage.append(halloweenControl(), form); layout.append(overview, manage); page.append(layout);
}
function advisorMapPage(page) {
  page.className = 'advisor-page';
  const ownClients = clients.filter(client => client.advisor_id === user?.id);
  // Cabecera como en Inicio y Cartera: título, una línea de ayuda, resumen en pastillas y la fecha a la derecha.
  const welcome = el('header', 'advisor-welcome map-welcome');
  const welcomeCopy = el('div', 'map-welcome-copy');
  const soldIds = new Set(sales.filter(sale => sale.confirmed && sale.advisor_id === user?.id).map(sale => sale.client_id));
  const soldTons = sales.filter(sale => sale.confirmed && sale.advisor_id === user?.id).reduce((total, sale) => total + Number(sale.tons_sold || 0), 0);
  const pendingTons = ownClients.filter(client => !soldIds.has(client.id)).reduce((total, client) => total + Number(client.tons_requested || 0), 0);
  const zonesCount = new Set(ownClients.map(client => client.department).filter(Boolean)).size;
  const chips = el('div', 'map-welcome-chips');
  for (const [className, text] of [
    ['map-chip-zones', `${zonesCount} ${zonesCount === 1 ? 'zona explorada' : 'zonas exploradas'}`],
    ['map-chip-sold', `${soldTons.toLocaleString('es-CO')} t vendidas`],
    ['map-chip-pending', `${pendingTons.toLocaleString('es-CO')} t por vender`],
  ]) chips.append(el('span', `map-chip ${className}`, text));
  welcomeCopy.append(el('h1', '', 'Mapa clientela'), el('p', '', 'Dónde ya vendiste y dónde quedan toneladas por ganar.'), chips);
  welcome.append(welcomeCopy, advisorCalendar());
  const section = el('section', 'advisor-map-panel');
  const status = el('p', 'advisor-map-status', 'Cargando mapa…');
  status.setAttribute('role', 'status');
  const container = el('div', 'advisor-map-canvas');
  container.setAttribute('aria-label', 'Mapa de departamentos de Colombia y ciudades con clientes');
  // Las leyendas, la brújula y la zona objetivo van encima del mapa (advisor-map.js).
  section.append(status, container);
  if (!ownClients.length) section.append(el('p', 'empty-state', 'Aún no tienes clientes asignados. Todos los departamentos están bloqueados.'));
  const zonesSlot = el('div', 'advisor-zone-slot');
  page.append(welcome, section, zonesSlot);
  Promise.all([import('./advisor-map.js'), loadZoneMarket().catch(() => null)]).then(async ([module, market]) => {
    if (!container.isConnected) return;
    advisorMapModule = module;
    // PRD · oportunidad por zona: el asesor ve solo las zonas donde tiene clientes.
    const zones = market ? getZoneOpportunities(market, ownClients, sales, { onlyWithClients: true }) : [];
    // Al elegir una zona de la lista, el mapa sube a la vista y la enfoca.
    let mapControls = null;
    const focusFromList = zone => {
      section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      mapControls?.focusZone(zone);
    };
    if (zones.length) zonesSlot.replaceWith(createZoneList(zones, { sample: market.sample, onSelect: focusFromList }));
    mapControls = await module.renderAdvisorClientMap(container, ownClients, (state, message) => {
      if (!container.isConnected) return;
      status.textContent = state === 'ready' ? 'Toca un departamento o una zona de la lista para enfocarla.' : message;
      status.classList.toggle('advisor-map-error', state === 'error');
    }, sales, { zones });
  }).catch(error => {
    if (!container.isConnected) return;
    status.textContent = `No se pudo cargar el mapa: ${error.message}`;
    status.classList.add('advisor-map-error');
  });
}
// Server truth for Progreso: the advisor's level and the level table. Until the migration
// is applied both calls fail and the page keeps using the profile and src/levels.js.
async function refreshProgress() {
  const [own, levels] = await Promise.all([db.rpc('get_my_level_progress').maybeSingle(), db.from('mvp_levels').select('level,name,min_confirmed_sales,reward_amount').order('level')]);
  if (import.meta.env.DEV && (own.error || levels.error)) console.warn('[progreso] usando niveles locales', own.error?.message || levels.error?.message);
  let changed = false;
  if (!levels.error && levels.data?.length) { progressLevels = levels.data; changed = true; }
  if (!own.error && own.data) {
    changed ||= profile.level !== own.data.level || profile.progression_sales !== own.data.confirmed_sales;
    Object.assign(profile, { level: own.data.level, progression_sales: own.data.confirmed_sales });
  }
  if (changed && advisorView === 'progress') render();
}
function destroyProgressWorld() {
  progressWorldRequest++;
  progressWorld?.destroy();
  progressWorld = null;
}
function readSeenLevel(key) {
  try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; }
}
function storeSeenLevel(key, level) {
  try { localStorage.setItem(key, String(level)); } catch { /* sin almacenamiento: se celebra de nuevo la próxima vez */ }
}
function advisorProgressPage(page) {
  const model = getProgressModel(profile.level, profile.progression_sales, progressLevels);
  const seenKey = `ultracem-progress-level-${user.id}`;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let view;
  const select = level => {
    progressSelected = level;
    view.select(level);
    progressWorld?.focus(level);
  };
  const celebrate = async (from, to) => {
    if (!progressWorld) return;
    await progressWorld.celebrate(from, to);
    if (!progressWorld) return;
    const reached = model.levels[to - 1];
    showLevelBanner(view.stage.parentElement, reached, reducedMotion);
    celebrateSale();
    showTopitinToast({ mascot: skinHappyImage(), title: `¡Subiste al nivel ${to}!`, body: `Desbloqueaste la isla "${reached.name}" y su recompensa de $ ${reached.reward.toLocaleString('es-CO')}.` });
  };
  view = renderProgressPage(page, model, {
    selected: progressSelected ?? model.level,
    onSelect: select,
    onClients: () => { advisorView = 'dashboard'; render(); window.scrollTo(0, 0); },
    onReplay: () => celebrate(model.level - 1, model.level),
  });
  if (progressWorld) {
    view.status.textContent = '';
    progressWorld.attach(view.stage, view.labels, select);
    progressWorld.setLevel(model.level);
    return;
  }
  const request = ++progressWorldRequest;
  import('./progress-scene.js')
    .then(module => module.createProgressScene(view.stage, { level: model.level, skinImage: skinHappyImage(), labels: view.labels, onSelect: select, reducedMotion }))
    .then(world => {
      if (request !== progressWorldRequest) { world.destroy(); return; }
      progressWorld = world;
      view.status.textContent = '';
      // First visit stores the level; later visits celebrate every level gained since then.
      const seen = readSeenLevel(seenKey) || model.level;
      storeSeenLevel(seenKey, model.level);
      if (model.level > seen) void celebrate(seen, model.level);
    })
    .catch(error => {
      if (request !== progressWorldRequest) return;
      view.status.textContent = `No se pudo cargar el mundo 3D (${error.message}). Tu progreso sigue disponible en el panel.`;
      view.status.classList.add('is-error');
    });
}
function advisorProfilePage(page) {
  renderAdvisorProfile(page, profile, { upload: uploadProfilePhoto, remove: removeProfilePhoto, signOut, deleteAccount }, profilePhotoSaving);
  playProfileEntrance(page, profileKeyboardNavigation);
}
// Archivada: la pestaña Historial de clientes ya no aparece en la navegación.
// Se conserva la vista por si se quiere recuperar.
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
function money(value) {
  return Number(value || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}
function commissionDate(value) {
  return value ? new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Fecha no disponible';
}
async function requestCommission(sale, control) {
  const previous = sales.find(item => item.id === sale.id);
  if (!previous) return;
  celebrateCommissionClaim(control, Number(previous.commission_amount || 0));
  control.disabled = true;
  control.textContent = 'Registrando…';
  const replace = next => { sales = sales.map(item => item.id === sale.id ? next : item); };
  const result = await optimisticWrite({
    label: 'reclamar comisión',
    apply: () => replace({ ...previous, commission_status: 'pending', commission_claimed_at: new Date().toISOString() }),
    revert: () => replace(previous),
    write: () => db.rpc('request_mvp_commission', { target_sale: sale.id }),
    reload: ['sales'],
  });
  if (!result) return;
  notice('La comisión fue canjeada satisfactoriamente.');
  if (advisorView === 'commissions') celebrateCommissionClaimed(document.querySelector('#page'));
}
function advisorCommissionsPage(page) {
  page.className = 'advisor-page commission-wallet-page';
  const ownSales = sales.filter(sale => sale.advisor_id === user?.id && sale.confirmed).sort((a, b) => new Date(b.confirmed_at || b.completed_at) - new Date(a.confirmed_at || a.completed_at));
  const summary = commissionSummary(ownSales, user?.id);
  const stats = commissionStats(ownSales);
  const welcome = el('header', 'advisor-welcome');
  const welcomeCopy = el('div');
  welcomeCopy.append(el('h1', '', 'Cartera de comisiones'), el('p', '', 'Revisa lo que tienes disponible y lo que ya canjeaste.'));
  welcome.classList.add('commission-welcome');
  welcome.append(welcomeCopy, advisorCalendar());
  const overview = el('section', 'commission-overview');
  const available = el('div', 'commission-balance');
  const availableSale = ownSales.find(sale => getCommissionStatus(sale).claimable);
  const balanceIcon = el('span', 'commission-balance-icon'); balanceIcon.innerHTML = advisorIcon('coin');
  const balanceCopy = el('div', 'commission-balance-copy');
  balanceCopy.append(el('span', '', 'Comisión disponible'), el('strong', '', money(summary.available)), el('small', '', availableSale ? `Por la venta de ${clients.find(client => client.id === availableSale.client_id)?.name || 'tu cliente'}` : 'No tienes comisiones disponibles'));
  available.append(balanceIcon, balanceCopy);
  if (availableSale) {
    const claimAll = button('Reclamar comisiones', 'primary commission-claim-all', () => page.querySelector('.commission-available-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    const claimAllIcon = el('span', 'commission-claim-icon'); claimAllIcon.innerHTML = advisorIcon('sparkles');
    claimAll.prepend(claimAllIcon);
    available.append(claimAll);
  }
  const redeemed = commissionTakeHome(summary.pending, ownSales.filter(sale => sale.commission_status === 'pending').length, skinHappyImage());
  overview.append(available, redeemed);
  page.append(welcome, overview, commissionGoals(stats));
  if (!ownSales.length) {
    page.append(el('p', 'empty-state', 'Aún no tienes ventas confirmadas para mostrar en tu cartera.'));
    return;
  }
  const availableList = el('section', 'commission-list');
  const redeemedList = el('section', 'commission-list commission-redeemed-list');
  const renderSale = (sale, list) => {
    const client = clients.find(item => item.id === sale.client_id);
    const status = getCommissionStatus(sale);
    const item = el('article', 'commission-item');
    const head = el('div', 'commission-item-head');
    const thumb = el('span', 'commission-thumb'); thumb.innerHTML = advisorIcon({ 'Ferretería': 'shop', Constructora: 'building', Distribuidor: 'truck' }[client?.type] || 'document');
    const copy = el('div', 'commission-client');
    copy.append(el('h2', '', client?.name || 'Cliente confirmado'), el('p', 'muted', status.claimable || !sale.commission_claimed_at ? `${client?.type || 'Venta confirmada'} · ${commissionDate(sale.confirmed_at || sale.completed_at)}` : `${client?.type || 'Venta confirmada'} · Canjeada el ${commissionDate(sale.commission_claimed_at)}`));
    head.append(thumb, copy);
    const statusBadge = el('span', `commission-status ${status.claimable ? 'available' : status.label === 'Canjeada' ? 'redeemed' : ''}`, status.label);
    const details = el('dl', 'commission-details');
    for (const [label, value] of [
      ['Toneladas vendidas', `${Number(sale.tons_sold || 0).toLocaleString('es-CO')} t`],
      ['Precio aplicado', sale.commission_price_per_ton ? `${money(sale.commission_price_per_ton)} / t` : '—'],
      ['Comisión', sale.commission_rate ? `${Math.round(Number(sale.commission_rate) * 100)}%` : '—'],
      ['Generada', sale.commission_amount ? money(sale.commission_amount) : 'Sin comisión configurada'],
    ]) {
      const row = el('div'); row.append(el('dt', '', label), el('dd', '', value)); details.append(row);
    }
    item.append(head, details, statusBadge);
    if (status.claimable) {
      const claim = button('Reclamar', 'primary commission-claim', event => requestCommission(sale, event.currentTarget));
      const claimIcon = el('span', 'commission-claim-icon'); claimIcon.innerHTML = advisorIcon('coin');
      claim.prepend(claimIcon);
      item.classList.add('claimable');
      item.append(claim);
    }
    list.append(item);
  };
  const claimedOn = sale => new Date(sale.commission_claimed_at || sale.confirmed_at || sale.completed_at);
  for (const sale of ownSales.filter(item => getCommissionStatus(item).claimable)) renderSale(sale, availableList);
  for (const sale of ownSales.filter(item => item.commission_status === 'pending' || item.commission_status === 'paid').sort((a, b) => claimedOn(b) - claimedOn(a))) renderSale(sale, redeemedList);
  if (availableList.childElementCount) {
    const section = el('section', 'commission-available-section');
    const heading = el('div', 'commission-list-head');
    heading.append(el('h2', 'commission-section-title', 'Comisiones disponibles'), el('span', 'muted', `${availableList.childElementCount} ${availableList.childElementCount === 1 ? 'comisión disponible' : 'comisiones disponibles'}`));
    section.append(heading, availableList);
    page.append(section);
  }
  const redeemedSection = el('section', 'commission-redeemed-section');
  if (redeemedList.childElementCount) redeemedSection.append(el('h2', 'commission-section-title', 'Comisiones canjeadas'), redeemedList);
  page.append(commissionMilestones(stats, redeemedList.childElementCount ? () => redeemedSection.scrollIntoView({ behavior: 'smooth', block: 'start' }) : null), redeemedSection);
  playCommissionEntrance(page);
}
async function requestClient(control) {
  control.disabled = true;
  control.textContent = 'Enviando…';
  const started = performance.now();
  const result = await db.rpc('request_mvp_client');
  measureAction('solicitar cliente (saved)', started);
  if (result.error) {
    control.disabled = false;
    control.textContent = 'Solicitar un cliente';
    notice(result.error.message, true);
    return;
  }
  if (!result.data?.duplicate) showTopitinToast({ mascot: skinHappyImage(), title: 'Solicitud enviada', body: 'Topitín ya le avisó al administrador. Te llegará una notificación cuando te asigne tu nuevo cliente.' });
  else showTopitinToast({ mascot: skinHappyImage(), tone: 'info', title: 'Ya pediste un cliente', body: 'Tu solicitud sigue pendiente. Topitín te avisará en cuanto el administrador la atienda.' });
  control.disabled = false;
  control.textContent = 'Solicitar un cliente';
  // The request only reaches the administrator's inbox; nothing on this view needs a reload.
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
  const levelProgress = getLevelProgress(profile?.level, profile?.progression_sales);
  const monthlyGoal = 100;
  const monthlyTons = getMonthlyTons(sales, user?.id);
  const weeklySales = getWeeklySales(sales, user?.id);
  const streak = getSalesStreak(sales, user?.id);
  const todaySales = getTodaySales(sales, user?.id);
  const rankingGap = getRankingGap(ranking, user?.id);
  const monthlyProgress = getMonthlyGoal(monthlyTons, monthlyGoal);
  const progressPercent = monthlyProgress.fill;
  const mascotImagesForSkin = profile?.equipped_skin === 'skeleton'
    ? { sad: '/skins/skeleton/sad.png', neutral: '/skins/skeleton/serious.png', happy: '/skins/skeleton/happy.png' }
    : mascotImages;

  page.append(advisorWelcome());
  const hero = el('section', 'advisor-hero');
  const ring = advisorProgressRing(portfolio.percentage, `${portfolio.completed} de ${portfolio.total} tareas completadas`, 'advisor-progress-ring');
  ring.querySelector('.ring-copy > span').replaceChildren(
    el('span', 'ring-task-count', `${portfolio.completed} de ${portfolio.total} tareas`),
    el('span', 'ring-task-caption', 'completadas'),
  );
  const heroCopy = el('div', 'advisor-hero-copy');
  const heroStats = el('div', 'hero-highlight-stats');
  const levelStat = el('div', 'hero-highlight hero-level-highlight');
  const levelIcon = el('span', 'hero-highlight-icon'); levelIcon.innerHTML = advisorIcon('trophy');
  levelStat.append(levelIcon, el('span', '', levelProgress.target ? `${levelProgress.sales}/${levelProgress.target} ventas para Nivel ${levelProgress.level + 1}` : 'Nivel máximo'), el('strong', '', `Nivel ${levelProgress.level}`));
  const streakStat = el('div', 'hero-highlight');
  const flame = el('span', 'hero-highlight-icon'); flame.innerHTML = advisorIcon('flame');
  streakStat.append(flame, el('span', '', 'Racha actual'), el('strong', '', `${streak} ${streak === 1 ? 'día' : 'días'}`));
  const salesStat = el('div', 'hero-highlight');
  const salesIcon = el('span', 'hero-highlight-icon'); salesIcon.innerHTML = advisorIcon('sales');
  salesStat.append(salesIcon, el('span', '', 'Ventas confirmadas'), el('strong', '', String(ownConfirmedSales.length)));
  heroStats.append(levelStat, streakStat, salesStat);
  heroCopy.append(heroStats, button('Ver mis tareas hoy', 'hero-cta', () => document.querySelector('#advisor-actions')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })));
  const mascot = el('div', 'mascot advisor-hero-mascot');
  const mascotImage = el('img', 'mascot-image');
  mascotImage.src = mascotImagesForSkin[mascotMood];
  mascotImage.alt = '';
  const pokeStats = { salesToday: todaySales.count, streak, position: ownRanking?.position, gap: rankingGap, monthlyPercent: monthlyProgress.percentage, level: levelProgress };
  const poke = button('', 'mascot-poke', () => pokeTopitin(activeClient, activeProgress, portfolio, pokeStats));
  poke.setAttribute('aria-label', `Tocar a Topitín (${mascotLabels[mascotMood]})`);
  poke.append(mascotImage);
  mascot.append(poke);
  hero.append(ring, heroCopy, mascot);
  page.append(hero);

  const totalClients = clients.filter(client => client.advisor_id === user?.id).length;
  const tonsUnit = value => value === 1 ? 'Tonelada' : 'Toneladas';
  const rankingBack = !rankingGap ? { label: 'Aún sin ranking', value: '—' }
    : rankingGap.kind === 'lead' ? { label: rankingGap.value === 1 ? 'Venta de ventaja' : 'Ventas de ventaja', value: rankingGap.value, count: rankingGap.value }
    : { label: `${rankingGap.value === 1 ? 'Venta' : 'Ventas'} para el #${rankingGap.target}`, value: rankingGap.value, count: rankingGap.value };
  page.append(metrics([
    ['Clientes actuales', currentClients.length, 'con acciones pendientes', currentClients.length, '', { name: 'clients', back: { label: 'Clientes totales', value: totalClients, count: totalClients } }],
    ['Vendidas', ownTons.toLocaleString('es-CO'), 'volumen confirmado', ownTons, tonsUnit(ownTons), { name: 'tons', back: { label: 'Vendidas hoy', value: todaySales.tons.toLocaleString('es-CO'), count: todaySales.tons, unit: tonsUnit(todaySales.tons) } }],
    ['Ventas confirmadas', ownConfirmedSales.length, 'cierres registrados', ownConfirmedSales.length, '', { name: 'sales', back: { label: 'Ventas confirmadas hoy', value: todaySales.count, count: todaySales.count } }],
    ['Posición global', ownRanking ? `#${ownRanking.position}` : '—', 'ranking comercial', undefined, '', { name: 'ranking', back: rankingBack }],
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
    request.type = 'button'; request.addEventListener('click', () => requestClient(request));
    request.setAttribute('aria-describedby', 'request-client-hint');
    const hint = el('p', 'advisor-empty-hint', 'El administrador recibirá tu solicitud y podrá asignarte un cliente.');
    hint.id = 'request-client-hint';
    empty.append(illustration, el('h3', '', clients.length ? 'No tienes clientes actuales pendientes' : 'Tu próxima oportunidad empieza aquí'),
      el('p', 'muted', clients.length ? 'Tus clientes con venta confirmada ya completaron su ruta. Solicita uno nuevo para seguir sumando.' : 'Aún no tienes clientes asignados. El administrador puede asignarte uno para empezar tu ruta comercial.'), request, hint);
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
      const setCompleted = (completed, points) => {
        clients = clients.map(client => client.id !== activeClient.id ? client : { ...client, tasks: client.tasks.map(item => item.id === task.id ? { ...item, completed, completed_at: completed ? new Date().toISOString() : null } : item) });
        // Mirrors the +5 points complete_mvp_task grants; the background reload confirms the real total.
        adjustOwnStats({ points });
        ranking = ranking.map(row => row.advisor_id === user.id ? { ...row, completed_tasks: Number(row.completed_tasks || 0) + (completed ? 1 : -1) } : row);
      };
      await optimisticWrite({
        label: 'completar tarea',
        apply: () => {
          setCompleted(true, 5);
          // El panel muestra su propio resumen de "todo listo"; no hace falta un aviso aparte.
          saleNotice = '';
          if (selectedId === activeClient.id) celebrate(() => { celebrateTask(origin); showMascotFeedback('task', progressBefore.completed + 1); });
        },
        revert: () => { setCompleted(false, -5); saleNotice = ''; },
        write: async () => {
          const result = await db.rpc('complete_mvp_task', { target_task: task.id });
          return isTaskCompletionConfirmed(result) ? result : { error: result?.error || new Error('La tarea ya fue actualizada. Recarga los datos.') };
        },
        reload: ['clients', 'stats', 'ranking'],
      });
    }));
    item.append(content, actions); taskList.append(item);
  }
  // Con las cuatro tareas hechas, un solo resumen con una acción principal; la lista
  // completada queda plegada para no repetir información.
  if (activeProgress.total === 4 && activeProgress.completed === 4) {
    const confirmed = getClientSaleState(activeClient, sales) === 'confirmed';
    const ready = el('div', `sale-ready${confirmed ? ' confirmed' : ''}`);
    const readyIcon = el('span', 'sale-ready-icon'); readyIcon.innerHTML = advisorIcon(confirmed ? 'trophy' : 'check');
    readyIcon.setAttribute('aria-hidden', 'true');
    const readyCopy = el('div', 'sale-ready-copy');
    const tonsValue = Number(activeClient.tons_requested || 0);
    const tons = `${tonsValue.toLocaleString('es-CO')} ${tonsValue === 1 ? 'tonelada' : 'toneladas'}`;
    readyCopy.append(
      el('strong', '', confirmed ? 'Venta confirmada' : 'Todo listo para confirmar la venta'),
      el('span', '', confirmed ? `${tons} registradas. Tu comisión ya está en la cartera.` : `${tons} · al confirmar sumas 100 puntos y se calcula tu comisión.`),
    );
    const saleActions = el('div', 'sale-actions');
    if (!confirmed) saleActions.append(button('Confirmar venta', 'primary confirm-sale-button', () => confirmSale(activeClient)));
    saleActions.append(button('Limpiar tareas', 'text-button clear-tasks-button', () => clearCompletedTasks(activeClient)));
    ready.append(readyIcon, readyCopy, saleActions);
    const doneTasks = el('details', 'sale-ready-tasks');
    doneTasks.append(el('summary', '', 'Ver las 4 tareas completadas'), taskList);
    detail.append(ready, doneTasks);
  } else detail.append(taskList);
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
  const weeklyHead = el('div', 'weekly-sales-head');
  const weeklyToggle = el('div', 'weekly-toggle');
  weeklyToggle.setAttribute('role', 'group');
  weeklyToggle.setAttribute('aria-label', 'Ver la semana en ventas o en toneladas');
  const weeklyNote = el('p', 'muted');
  const weeklyTotal = el('p', 'muted');
  const chart = el('div', 'weekly-chart');
  const columns = weeklySales.map(day => {
    const column = el('div', 'weekly-chart-column');
    const value = el('strong');
    const bar = el('span', 'weekly-chart-bar');
    column.append(value, bar, el('span', '', day.label));
    chart.append(column);
    return { day, value, bar };
  });
  const formatTons = value => value.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  const paintWeekly = animate => {
    const tons = weeklyChartMode === 'tons';
    const values = weeklySales.map(day => tons ? day.tons : day.count);
    const max = Math.max(1, ...values);
    const total = values.reduce((sum, value) => sum + value, 0);
    weeklyToggle.dataset.mode = weeklyChartMode;
    for (const control of weeklyToggle.querySelectorAll('button')) control.setAttribute('aria-pressed', String(control.dataset.mode === weeklyChartMode));
    weeklyNote.textContent = tons ? 'Toneladas confirmadas por día.' : 'Número de ventas confirmadas por día.';
    weeklyTotal.textContent = tons ? `${formatTons(total)} ${total === 1 ? 'tonelada vendida' : 'toneladas vendidas'} esta semana` : `${total} ventas registradas esta semana`;
    const heights = columns.map(({ day, value, bar }, index) => {
      const amount = values[index];
      value.textContent = tons ? formatTons(amount) : String(amount);
      bar.title = `${day.label}: ${tons ? `${formatTons(amount)} t` : `${amount} ventas`}`;
      return `${amount ? Math.max(16, Math.round((amount / max) * 100)) : 4}%`;
    });
    if (animate) morphWeeklyChart(columns.map(column => column.bar), heights, columns.map(column => column.value));
    else columns.forEach(({ bar }, index) => { bar.style.height = heights[index]; });
  };
  for (const [mode, label] of [['sales', 'Ventas'], ['tons', 'Toneladas']]) {
    const control = button(label, 'weekly-toggle-option', () => {
      if (weeklyChartMode === mode) return;
      weeklyChartMode = mode;
      paintWeekly(true);
    });
    control.dataset.mode = mode;
    weeklyToggle.append(control);
  }
  weeklyHead.append(el('h2', '', 'Ventas de la semana'), weeklyToggle);
  weeklyCard.append(weeklyHead, weeklyNote, chart, weeklyTotal);
  paintWeekly(false);
  leftColumn.append(goalCard, portfolioCard); rightColumn.append(weeklyCard);
  for (const [card, name] of [[leftColumn.firstChild, 'trophy'], [panel, 'tasks'], [goalCard, 'target'], [portfolioCard, 'clients'], [weeklyCard, 'sales']]) {
    const icon = el('span', 'dashboard-heading-icon'); icon.innerHTML = advisorIcon(name); card.querySelector('h2').prepend(icon);
  }
}

// Saludo de Inicio: una frase corta con el nombre destacado y la fecha de hoy.
function advisorWelcome() {
  const welcome = el('div', 'advisor-welcome');
  const title = el('h1');
  const name = el('span', 'advisor-welcome-name', profile.full_name);
  const nameLine = el('span', 'advisor-welcome-name-line');
  nameLine.setAttribute('aria-hidden', 'true');
  name.append(nameLine);
  title.append('¡Vamos con toda hoy, ', name, '!');
  welcome.append(title, advisorCalendar());
  return welcome;
}

// Fecha de hoy con la hoja de calendario; en móvil el CSS la vuelve una pastilla.
function advisorCalendar() {
  const now = new Date();
  const calendar = el('time', 'advisor-calendar');
  calendar.dateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const tile = el('span', 'advisor-calendar-tile');
  tile.setAttribute('aria-hidden', 'true');
  tile.append(el('span', 'advisor-calendar-month', now.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')), el('strong', 'advisor-calendar-day', String(now.getDate())));
  const calendarCopy = el('span', 'advisor-calendar-copy');
  calendarCopy.append(
    el('strong', 'advisor-calendar-weekday', now.toLocaleDateString('es-CO', { weekday: 'long' })),
    el('span', 'advisor-calendar-date', now.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })),
  );
  calendar.append(tile, calendarCopy);
  return calendar;
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
  const previousSale = sales.find(sale => sale.client_id === client.id);
  const tons = Number(client.tons_requested || 0);
  const now = new Date().toISOString();
  // Amount and commission come from server settings; the background reload fills them in.
  const optimisticSale = { commission_status: null, commission_amount: null, ...previousSale, id: previousSale?.id ?? `pending-${client.id}`, client_id: client.id, advisor_id: user.id, confirmed: true, tons_sold: tons, completed_at: previousSale?.completed_at ?? now, confirmed_at: now };
  const previousNotice = saleNotice;
  await optimisticWrite({
    label: 'confirmar venta',
    apply: () => {
      sales = previousSale ? sales.map(sale => sale === previousSale ? optimisticSale : sale) : [...sales, optimisticSale];
      // Mirrors the base +100 points of confirm_mvp_sale; level and its bonus arrive with the reload.
      adjustOwnStats({ points: 100, sales: 1, tons });
      profile.progression_sales = Number(profile.progression_sales || 0) + 1;
      saleNotice = '';
      celebrate(() => { celebrateSale(); showMascotFeedback('sale'); });
    },
    revert: () => {
      sales = previousSale ? sales.map(sale => sale === optimisticSale ? previousSale : sale) : sales.filter(sale => sale !== optimisticSale);
      adjustOwnStats({ points: -100, sales: -1, tons: -tons });
      profile.progression_sales = Number(profile.progression_sales || 0) - 1;
      saleNotice = previousNotice;
    },
    write: () => db.rpc('confirm_mvp_sale', { target_client: client.id }),
    reload: ['sales', 'stats', 'ranking'],
  });
}
function adjustOwnStats({ points = 0, sales: saleCount = 0, tons = 0 }) {
  profile.points = Number(profile.points || 0) + points;
  ranking = ranking.map(row => row.advisor_id !== user.id ? row : {
    ...row,
    points: Number(row.points || 0) + points,
    confirmed_sales: Number(row.confirmed_sales || 0) + saleCount,
    confirmed_tons: Number(row.confirmed_tons || 0) + tons,
  });
}
let queuedEffect = null;
function celebrate(play) {
  queuedEffect = play;
}
function playQueuedEffect() {
  const play = queuedEffect;
  queuedEffect = null;
  if (!play || !document.querySelector('.advisor-page')) return;
  effectsUntil = performance.now() + 3400;
  play();
}
// Administrator actions reload the shared lists in one round trip, without the profile or avatar signing.
async function refresh(text, resources = ['advisors', 'clients', 'sales', 'ranking']) {
  const started = performance.now();
  try {
    const values = await Promise.all(resources.map(name => resourceLoaders[name]()));
    resources.forEach((name, index) => applyResource(name, values[index]));
    render();
    notice(text);
  }
  catch (cause) { notice(`El cambio se guardó, pero no se pudo actualizar la vista: ${cause.message}`, true); }
  finally { measureAction(`refresh ${resources.join('+')}`, started); }
}
function render() {
  advisorMapModule?.destroyAdvisorClientMap();
  if (!profile || profile.role !== 'advisor' || advisorView !== 'progress') destroyProgressWorld();
  clearProfileEntrance(!profile || profile.role !== 'advisor' || advisorView !== 'profile');
  if (!profile || profile.role !== 'advisor' || advisorView !== 'commissions') resetCommissionEntrance();
  if (!profile || profile.role !== 'advisor' || advisorView !== 'dashboard') resetAdvisorEntrance();
  const storeView = profile?.role === 'admin' ? (adminView === 'shop' ? 'shop' : null) : ['shop', 'rewards'].includes(advisorView) ? advisorView : null;
  if (!profile || !storeView) resetStoreEntrance();
  shell();
  const page = document.querySelector('#page');
  if (!db) page.replaceChildren(el('p', 'empty-state', 'Falta configurar Supabase en .env.local.'));
  else if (!profile) authPage();
  else if (profile.role === 'admin' && adminView === 'shop') { renderShop(page, sales.filter(sale => sale.confirmed).length, halloweenReady && halloweenEnabled, profile.equipped_skin, equipSkin, profile.points); playStoreEntrance(page, 'shop'); }
  else if (profile.role === 'admin') adminPage(page);
  else if (advisorView === 'shop') { renderShop(page, sales.filter(sale => sale.advisor_id === user?.id && sale.confirmed).length, halloweenReady && halloweenEnabled, profile.equipped_skin, equipSkin, profile.points); playStoreEntrance(page, 'shop'); }
  else if (advisorView === 'rewards') { renderRewards(page, profile.points, new Date(), halloweenReady && halloweenEnabled); playStoreEntrance(page, 'rewards'); }
  else if (advisorView === 'history') advisorHistoryPage(page);
  else if (advisorView === 'commissions') advisorCommissionsPage(page);
  else if (advisorView === 'map') advisorMapPage(page);
  else if (advisorView === 'progress') advisorProgressPage(page);
  else if (advisorView === 'profile') advisorProfilePage(page);
  else {
    advisorPage(page);
    playAdvisorEntrance(root);
    bindAdvisorHover();
  }
  paintHalloween();
  if (profilePhotoPromptPending && profile?.role === 'advisor') openProfilePanel(true);
}
if (db) boot(); else render();
