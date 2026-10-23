export function createNotificationCenter(host, { notifications = [], role, onRead, onAction, onRefresh, onClearRead }) {
  let items = notifications;
  let disposed = false, refreshing = false;
  const pendingReads = new Map();
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const control = (className, text, callback) => {
    const node = make('button', className, text);
    node.type = 'button';
    node.addEventListener('click', callback);
    return node;
  };
  const center = make('div', 'notification-center');
  const panel = make('section', 'notification-panel');
  panel.id = 'notification-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'notification-heading');
  const bell = control('notification-bell', '', async () => {
    if (!panel.hidden) { close(); return; }
    panel.hidden = false;
    bell.setAttribute('aria-expanded', 'true');
    closeButton.focus();
    if (!onRefresh || refreshing) return;
    refreshing = true;
    feedback.textContent = 'Buscando notificaciones…';
    try {
      const latest = await onRefresh();
      if (!disposed) { update(latest); feedback.textContent = ''; }
    } catch {
      if (!disposed) feedback.textContent = 'No se pudieron actualizar las notificaciones. Cierra y vuelve a abrir para reintentar.';
    } finally { refreshing = false; }
  });
  bell.setAttribute('aria-expanded', 'false');
  bell.setAttribute('aria-controls', panel.id);
  bell.setAttribute('aria-haspopup', 'dialog');
  const icon = make('span', 'notification-bell-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
  const dot = make('span', 'notification-unread-dot');
  dot.setAttribute('aria-hidden', 'true');
  bell.append(icon, dot);
  const header = make('header', 'notification-header');
  const title = make('h2', '', 'Notificaciones'); title.id = 'notification-heading';
  const count = make('span', 'notification-count');
  const clearRead = control('notification-clear-read', 'Limpiar leídas', async () => {
    clearRead.disabled = true;
    feedback.textContent = '';
    try { await onClearRead?.(); }
    catch { if (!disposed) feedback.textContent = 'No se pudieron limpiar las notificaciones leídas.'; }
    finally { if (!disposed) clearRead.disabled = false; }
  });
  clearRead.hidden = true;
  const closeButton = control('notification-close', '×', () => close());
  closeButton.setAttribute('aria-label', 'Cerrar notificaciones');
  header.append(title, count, clearRead, closeButton);
  const feedback = make('p', 'notification-feedback');
  feedback.setAttribute('role', 'status');
  const list = make('div', 'notification-list');
  panel.append(header, feedback, list);
  center.append(panel, bell);
  host.append(center);
  host.classList.add('has-notification-center');

  function close(restoreFocus = true) {
    panel.hidden = true;
    bell.setAttribute('aria-expanded', 'false');
    if (restoreFocus) bell.focus();
  }
  function updateBadge() {
    const unread = items.filter(item => !item.read_at).length;
    dot.hidden = unread === 0;
    count.textContent = unread ? `${unread} sin leer` : 'Al día';
    clearRead.hidden = !items.some(item => item.read_at);
    bell.setAttribute('aria-label', unread ? `Notificaciones: ${unread} sin leer` : 'Notificaciones');
  }
  async function read(item, row) {
    if (item.read_at) return;
    if (pendingReads.has(item.id)) return pendingReads.get(item.id);
    const task = (async () => {
      await onRead(item);
      if (disposed) return;
      item.read_at = new Date().toISOString();
      items = items.map(value => value.id === item.id ? { ...value, read_at: item.read_at } : value);
      row.classList.remove('is-unread');
      row.querySelector('.notification-read-state').textContent = 'Leída';
      updateBadge();
    })();
    pendingReads.set(item.id, task);
    try { await task; } finally { pendingReads.delete(item.id); }
  }
  function update(next) {
    if (disposed) return;
    const readStates = new Map(items.filter(item => item.read_at).map(item => [item.id, item.read_at]));
    items = next.map(item => ({ ...item, read_at: item.read_at || readStates.get(item.id) || null }));
    list.replaceChildren();
    updateBadge();
    if (!items.length) {
      list.append(make('p', 'notification-empty', 'No tienes notificaciones por ahora. Las novedades aparecerán aquí.'));
      return;
    }
    for (const item of items) {
      const row = make('article', `notification-item${item.read_at ? '' : ' is-unread'}`);
      const entry = make('div', 'notification-entry');
      entry.setAttribute('aria-label', `Consultar notificación: ${item.title || 'Nueva notificación'}`);
      const state = make('span', 'notification-read-state', item.read_at ? 'Leída' : 'Nueva');
      entry.append(state, make('strong', 'notification-title', item.title || 'Nueva notificación'), make('span', 'notification-body', item.body || ''));
      const date = new Date(item.created_at);
      if (!Number.isNaN(date.getTime())) {
        const time = make('time', 'notification-time', new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date));
        time.dateTime = date.toISOString(); entry.append(time);
      }
      row.append(entry);
      if (!item.read_at) {
        const markRead = control('notification-mark-read', 'Marcar como leído', async () => {
          markRead.disabled = true;
          feedback.textContent = '';
          try { await read(item, row); markRead.hidden = true; }
          catch (error) { if (!disposed) feedback.textContent = error instanceof Error && error.message ? error.message : 'No se pudo marcar como leída. Intenta de nuevo.'; }
          finally { markRead.disabled = false; }
        });
        row.append(markRead);
      }
      const label = role === 'admin' && item.kind === 'client_request' ? 'Asignar cliente'
        : role !== 'admin' && item.kind === 'client_assigned' ? 'Ver mis próximas acciones'
        : item.kind === 'commission_secret' ? 'Ir a mi cartera' : null;
      if (label) {
        const action = control('notification-action', label, async () => {
          action.disabled = true;
          feedback.textContent = '';
          try {
            await onAction(item);
            if (!disposed) close(false);
          } catch { if (!disposed) feedback.textContent = 'No se pudo abrir esta notificación. Intenta de nuevo.'; }
          finally { action.disabled = false; }
        });
        row.append(action);
      }
      list.append(row);
    }
  }
  const outside = event => { if (!panel.hidden && !center.contains(event.target)) close(false); };
  const escape = event => { if (event.key === 'Escape' && !panel.hidden) close(); };
  document.addEventListener('pointerdown', outside);
  document.addEventListener('keydown', escape);
  update(items);
  return {
    update,
    destroy() {
      disposed = true;
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      center.remove();
      host.classList.remove('has-notification-center');
    },
  };
}
