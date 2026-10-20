export const STORAGE_KEY = 'ultracem-gamificacion-demo-v1';

function isValid(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.clients)) return false;
  const ids = new Set();
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const uniqueId = value => {
    if (!text(value) || ids.has(value)) return false;
    ids.add(value);
    return true;
  };
  return state.clients.every(client => {
    if (!client || !uniqueId(client.id) || !text(client.name)
      || !Array.isArray(client.tasks) || client.tasks.length !== 4) return false;
    const templates = new Set();
    return client.tasks.every(task => {
      if (!task || !uniqueId(task.id) || !text(task.templateId) || templates.has(task.templateId)
        || !text(task.title) || !text(task.description) || !text(task.reason)
        || typeof task.completed !== 'boolean') return false;
      templates.add(task.templateId);
      return true;
    });
  });
}

export function loadState(storage) {
  const empty = { version: 1, clients: [] };
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
    if (raw === null) return { state: empty, message: 'No hay datos guardados. Crea tu primer cliente para comenzar.' };
    const state = JSON.parse(raw);
    if (!isValid(state)) throw new Error('Formato inválido');
    return { state, message: '' };
  } catch {
    return { state: empty, message: 'No se pudieron leer los datos guardados. La demo inicia vacía; puedes crear un cliente para continuar.' };
  }
}

export function saveState(state, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(STORAGE_KEY, JSON.stringify(state));
    return '';
  } catch {
    return 'No se pudo guardar. Los cambios no se conservarán al recargar; puedes seguir usando la demo.';
  }
}

export function resetState(storage) {
  try {
    (storage ?? globalThis.localStorage).removeItem(STORAGE_KEY);
    return '';
  } catch {
    return 'No se pudieron borrar los datos guardados. Se vació la sesión actual, pero los datos podrían reaparecer al recargar.';
  }
}
