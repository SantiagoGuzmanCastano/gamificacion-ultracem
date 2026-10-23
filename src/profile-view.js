import { gsap } from 'gsap';
import { advisorIcon } from './advisor-icons.js';
import { getLevelProgress } from './game.js';

let entrance = null;
let entered = false;

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function action(label, className, handler) {
  const node = element('button', className, label);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
}

export function createProfileAvatar(profile, modifier = '') {
  const className = `profile-avatar ${modifier}`.trim();
  const fallback = () => {
    const node = element('span', `${className} profile-avatar-placeholder`, profile.full_name?.trim().slice(0, 1).toUpperCase() || 'A');
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', `Perfil de ${profile.full_name || 'Asesor'}`);
    node.dataset.advisorId = profile.advisor_id || profile.user_id || '';
    return node;
  };
  if (!profile.avatar_url) return fallback();
  const image = element('img', className);
  image.alt = `Foto de ${profile.full_name}`;
  image.dataset.advisorId = profile.advisor_id || profile.user_id || '';
  image.width = image.height = modifier === 'profile-page-avatar' ? 112 : modifier === 'profile-dialog-avatar' ? 74 : 42;
  image.addEventListener('error', () => image.replaceWith(fallback()), { once: true });
  image.src = profile.avatar_url;
  return image;
}

export function createProfilePhotoPicker(upload, { prompt = false, busy = false } = {}) {
  const picker = element('div', 'profile-photo-picker');
  const input = element('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp';
  input.hidden = true;
  const choose = action('', 'profile-action profile-action-primary profile-photo-action', () => input.click());
  choose.disabled = busy;
  const icon = element('span', 'profile-action-icon');
  icon.innerHTML = advisorIcon('camera');
  const label = element('span', 'profile-upload-label', busy ? 'Guardando foto…' : prompt ? 'Elegir foto' : 'Cambiar foto');
  label.dataset.defaultLabel = prompt ? 'Elegir foto' : 'Cambiar foto';
  choose.append(icon, label);
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (file) upload(file);
  });
  picker.append(choose, input);
  return picker;
}

// Logros calculados con datos reales; nunca se inventan.
export function getProfileAchievements({ sales = 0, tons = 0, streak = 0 }) {
  return [
    { id: 'first-sale', name: 'Primera venta', unlocked: sales >= 1 },
    { id: 'streak-3', name: 'Racha de 3 días', unlocked: streak >= 3 },
    { id: 'tons-50', name: '50 t vendidas', unlocked: tons >= 50 },
  ];
}

function renderProgress(progress, openShop) {
  const section = element('section', 'profile-section profile-progress');
  const heading = element('h2', '', 'Tu progreso');
  heading.id = 'profile-progress-title';
  section.setAttribute('aria-labelledby', heading.id);
  const stats = element('div', 'profile-stats');
  for (const [label, value, icon] of [
    ['Ventas confirmadas', String(progress.sales), 'sales'],
    ['Toneladas vendidas', `${Number(progress.tons).toLocaleString('es-CO')} t`, 'truck'],
    ['Racha actual', `${progress.streak} ${progress.streak === 1 ? 'día' : 'días'}`, 'flame'],
    ['Posición', progress.position ? `#${progress.position}` : '—', 'trophy'],
  ]) {
    const stat = element('div', `profile-stat profile-stat-${icon}`);
    const glyph = element('i', 'profile-stat-icon');
    glyph.setAttribute('aria-hidden', 'true');
    glyph.innerHTML = advisorIcon(icon);
    stat.append(glyph, element('span', '', label), element('strong', '', value));
    stats.append(stat);
  }
  const skin = element('div', 'profile-skin');
  const image = element('img');
  image.src = progress.skinImage;
  image.alt = 'Topitín con tu skin equipada';
  image.width = image.height = 120;
  skin.append(image, action('Cambiar en la Tienda', 'profile-action profile-action-secondary', openShop));
  const badges = element('ul', 'profile-achievements');
  badges.setAttribute('aria-label', 'Logros');
  for (const item of getProfileAchievements(progress)) {
    const badge = element('li', 'profile-achievement');
    badge.dataset.unlocked = String(item.unlocked);
    const glyph = element('i', 'profile-achievement-icon');
    glyph.setAttribute('aria-hidden', 'true');
    glyph.innerHTML = advisorIcon(item.unlocked ? 'check' : 'lock');
    badge.append(glyph, element('strong', '', item.name), element('span', '', item.unlocked ? 'Conseguido' : 'Bloqueado'));
    badges.append(badge);
  }
  const body = element('div', 'profile-progress-body');
  const column = element('div', 'profile-progress-column');
  column.append(stats, badges);
  body.append(column, skin);
  section.append(heading, body);
  return section;
}

export function renderAdvisorProfile(page, profile, actions, busy = false, progress = null) {
  page.className = 'advisor-page profile-page';
  const header = element('header', 'advisor-welcome profile-heading');
  header.append(element('h1', '', 'Perfil'), element('p', '', 'Tu espacio personal en Ultracem.'));
  const panel = element('section', 'profile-section profile-identity');
  panel.setAttribute('aria-label', 'Tu perfil');
  const identity = element('div', 'profile-identity-header');
  const copy = element('div', 'profile-identity-copy');
  copy.append(element('h2', '', profile.full_name));
  const role = element('p', 'profile-role');
  const roleIcon = element('span', 'profile-role-icon');
  roleIcon.innerHTML = advisorIcon('profile');
  role.append(roleIcon, element('span', '', profile.role === 'advisor' ? 'Asesor comercial' : 'Administrador'));
  copy.append(role);
  identity.append(createProfileAvatar(profile, 'profile-page-avatar'), copy);
  if (profile.role === 'advisor') {
    const levelProgress = getLevelProgress(profile.level, profile.progression_sales);
    const progression = element('section', 'profile-progression');
    progression.setAttribute('aria-label', 'Progreso del asesor');
    const heading = element('h3', '', 'Progreso del asesor');
    const values = element('div', 'profile-progression-values');
    const level = element('div', 'profile-progression-value');
    const levelIcon = element('span', 'profile-progression-icon'); levelIcon.innerHTML = advisorIcon('trophy');
    level.append(levelIcon, element('span', '', `Nivel ${levelProgress.level}`));
    const points = element('div', 'profile-progression-value profile-progression-points');
    const pointsIcon = element('span', 'profile-progression-icon'); pointsIcon.innerHTML = advisorIcon('sparkles');
    points.append(pointsIcon, element('span', '', `${Number(profile.points || 0).toLocaleString('es-CO')} puntos`));
    values.append(level, points);
    const salesLabel = levelProgress.target
      ? `${levelProgress.sales} de ${levelProgress.target} ventas para Nivel ${levelProgress.level + 1}`
      : 'Nivel máximo inicial alcanzado';
    const track = element('div', 'profile-progression-track');
    const fill = element('span'); fill.style.width = `${levelProgress.percentage}%`;
    track.append(fill);
    progression.append(heading, values, element('p', 'profile-progression-sales', salesLabel), track);
    panel.append(identity, progression);
  } else panel.append(identity);
  const photo = element('div', 'profile-photo-settings');
  const description = element('div', 'profile-section-copy');
  const hint = element('p', '', 'JPG, PNG o WebP. Máximo 5 MB.');
  hint.id = 'profile-photo-hint';
  description.append(element('h3', '', 'Foto de perfil'), hint);
  const controls = element('div', 'profile-photo-controls');
  controls.setAttribute('aria-describedby', hint.id);
  controls.append(createProfilePhotoPicker(actions.upload, { busy }));
  if (profile.avatar_path) {
    const remove = action('Quitar foto', 'profile-action profile-action-secondary profile-photo-action', actions.remove);
    remove.disabled = busy;
    controls.append(remove);
  }
  const status = element('p', 'profile-upload-status', busy ? 'Guardando foto…' : '');
  status.setAttribute('role', 'status');
  photo.append(description, controls, status);
  panel.append(photo);
  page.append(header, panel);
  if (profile.role !== 'advisor') return;
  if (progress) page.append(renderProgress(progress, actions.openShop));
  for (const [kind, title, text, label, handler, icon] of [
    ['session', 'Tu sesión', 'Puedes volver a entrar cuando lo necesites.', 'Cerrar sesión', actions.signOut, 'logout'],
    ['danger', 'Eliminar cuenta', 'Se borrarán tu cuenta, clientes, tareas, ventas y progreso. Esta acción no se puede deshacer.', 'Borrar cuenta', actions.deleteAccount, 'trash'],
  ]) {
    const section = element('section', `profile-section profile-${kind}`);
    const heading = element('h2', '', title);
    heading.id = `profile-${kind}-title`;
    section.setAttribute('aria-labelledby', heading.id);
    const sectionCopy = element('div', 'profile-section-copy');
    sectionCopy.append(heading, element('p', '', text));
    const control = action('', `profile-action profile-action-${kind === 'danger' ? 'danger' : 'secondary'}`, handler);
    const glyph = element('span', 'profile-action-icon');
    glyph.innerHTML = advisorIcon(icon);
    // Keep visible text separate so icons never become part of the accessible label.
    control.append(glyph, element('span', '', label));
    section.append(sectionCopy, control);
    page.append(section);
  }
}

export function playProfileEntrance(page, keyboard = false) {
  if (entered) return;
  entered = true;
  if (keyboard || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  entrance = gsap.context(() => {
    gsap.fromTo(page, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .26, ease: 'power3.out', clearProps: 'opacity,transform' });
  }, page);
}

export function clearProfileEntrance(leaving = true) {
  entrance?.revert();
  entrance = null;
  if (leaving) entered = false;
}
