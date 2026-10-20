export const STORAGE_KEY = 'ultracem-gamificacion-demo-v1';

const emptyState = () => ({ version: 2, advisors: [], customers: [] });

function isValid(state) {
  if (!state || state.version !== 2 || !Array.isArray(state.advisors) || !Array.isArray(state.customers)) return false;
  const ids = new Set();
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const uniqueId = value => {
    if (!text(value) || ids.has(value)) return false;
    ids.add(value);
    return true;
  };
  if (!state.advisors.every(advisor => advisor && uniqueId(advisor.id) && text(advisor.name))) return false;
  const advisorIds = new Set(state.advisors.map(advisor => advisor.id));
  return state.customers.every(customer => {
    if (!customer || !uniqueId(customer.id) || !text(customer.name) || !text(customer.type)
      || !advisorIds.has(customer.advisorId) || !Array.isArray(customer.tasks)
      || customer.tasks.length !== 4) return false;
    const templates = new Set();
    return customer.tasks.every(task => {
      if (!task || !uniqueId(task.id) || !text(task.templateId) || templates.has(task.templateId)
        || !text(task.title) || !text(task.description) || !text(task.reason)
        || typeof task.completed !== 'boolean') return false;
      templates.add(task.templateId);
      return true;
    });
  });
}

export function loadState(storage) {
  const empty = emptyState();
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
    if (raw === null) return { state: empty, message: 'No hay datos guardados. Crea un asesor para comenzar.' };
    let state = JSON.parse(raw);
    if (state?.version === 1 && Array.isArray(state.clients)) {
      const clients = state.clients;
      state = {
        version: 2,
        advisors: clients.map(({ id, name }) => ({ id, name })),
        customers: clients.map(({ id, name, tasks }) => ({
          id: crypto.randomUUID(), name: `Cliente anterior de ${name}`, type: 'Sin definir', advisorId: id, tasks,
        })),
      };
      if (!isValid(state)) throw new Error('Formato inválido');
      const warning = saveState(state, storage);
      return { state, message: warning || 'Se conservaron los datos anteriores. Puedes renombrar los clientes cuando ampliemos la edición.' };
    }
    if (!isValid(state)) throw new Error('Formato inválido');
    return { state, message: '' };
  } catch {
    return { state: empty, message: 'No se pudieron leer los datos guardados. La demo inicia vacía; puedes crear un asesor para continuar.' };
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
