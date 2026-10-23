// Modo demo: imita la forma del cliente de Supabase con datos de muestra en memoria y sin red.
// Se activa con VITE_DEMO=true (src/main.js). Todo lo que se ve es "Muestra": se reinicia al recargar.
// Spec: tests/demo-client.spec.js.

export const DEMO_ADVISOR_ID = 'demo-asesor';
const DEMO_ADMIN_ID = 'demo-admin';
const DAY_MS = 24 * 60 * 60 * 1000;
const TASKS = [
  ['Preparar una visita', 'Define el objetivo de una visita comercial.'],
  ['Contactar al cliente', 'Registra una llamada de seguimiento.'],
  ['Revisar una cotización', 'Confirma si una cotización sigue vigente.'],
  ['Planear el siguiente paso', 'Define la próxima acción para este cliente.'],
];
const DEMO_ONLY = 'No disponible en modo demo.';

function seed(now) {
  const at = days => new Date(now.getTime() - days * DAY_MS).toISOString();
  const profiles = [
    { user_id: DEMO_ADVISOR_ID, full_name: 'Asesor Demo', role: 'advisor', equipped_skin: 'classic', avatar_path: null, photo_prompted_at: at(1), email: 'asesor@demo.test' },
    { user_id: 'demo-asesor-2', full_name: 'Asesor Dos', role: 'advisor', equipped_skin: 'classic', avatar_path: null, photo_prompted_at: at(1), email: 'dos@demo.test' },
    { user_id: 'demo-asesor-3', full_name: 'Asesor Tres', role: 'advisor', equipped_skin: 'classic', avatar_path: null, photo_prompted_at: at(1), email: 'tres@demo.test' },
    { user_id: DEMO_ADMIN_ID, full_name: 'Administración Demo', role: 'admin', equipped_skin: 'classic', avatar_path: null, photo_prompted_at: at(1), email: 'admin@demo.test' },
  ];
  // [id, nombre, tipo, asesor, toneladas pedidas, tareas completadas, días desde la creación, departamento, ciudad]
  const clientRows = [
    ['demo-c1', 'Ferretería Norte', 'Ferretería', DEMO_ADVISOR_ID, 20, 2, 1, 'Atlántico', 'Barranquilla'],
    ['demo-c2', 'Constructora Caribe', 'Constructora', DEMO_ADVISOR_ID, 35, 0, 2, 'Bolívar', 'Cartagena de Indias'],
    ['demo-c3', 'Depósito La Sexta', 'Distribuidor', DEMO_ADVISOR_ID, 15, 4, 3, 'Atlántico', 'Barranquilla'],
    ['demo-c4', 'Materiales del Sur', 'Distribuidor', 'demo-asesor-2', 80, 4, 4, 'Valle del Cauca', 'Cali'],
    ['demo-c5', 'Ferretería El Puente', 'Ferretería', 'demo-asesor-2', 25, 4, 5, 'Antioquia', 'Medellín'],
    ['demo-c6', 'Obras y Techos', 'Constructora', 'demo-asesor-3', 85, 4, 6, 'Bogotá D.C.', 'Bogotá D.C.'],
  ];
  const clients = clientRows.map(([id, name, type, advisor_id, tons_requested, , age, department, city]) => ({ id, name, type, advisor_id, tons_requested, department, city, created_at: at(age) }));
  const tasks = clientRows.flatMap(([id, , , , , done]) => TASKS.map(([title, description], index) => ({
    id: `${id}-t${index + 1}`, client_id: id, title, description, completed_at: index < done ? at(1) : null,
  })));
  const sale = (client, advisor, tons, daysAgo) => ({
    id: `demo-s-${client}`, client_id: client, advisor_id: advisor, amount: tons * 25000, tons_sold: tons,
    completed_at: at(daysAgo), confirmed: true, confirmed_at: at(daysAgo),
  });
  // Semáforo del admin con meta de 100 t: Dos cumple (105 t), Tres en riesgo (85 t), Demo crítico (15 t).
  const sales = [sale('demo-c3', DEMO_ADVISOR_ID, 15, 1), sale('demo-c4', 'demo-asesor-2', 80, 2), sale('demo-c5', 'demo-asesor-2', 25, 0), sale('demo-c6', 'demo-asesor-3', 85, 1)];
  return { profiles, clients, tasks, sales, settings: { id: true, halloween_enabled: false } };
}

const pick = (row, columns) => {
  if (!columns || columns === '*') return { ...row };
  return Object.fromEntries(columns.split(',').map(column => column.trim()).filter(Boolean).map(column => [column, row[column] ?? null]));
};
const ok = data => ({ data, error: null });
const fail = message => ({ data: null, error: { message } });

export function createDemoClient({ role = 'advisor', now = new Date() } = {}) {
  const state = seed(now);
  const userId = role === 'admin' ? DEMO_ADMIN_ID : DEMO_ADVISOR_ID;
  let signedIn = true;
  const me = () => state.profiles.find(profile => profile.user_id === userId);
  const isAdmin = () => me()?.role === 'admin';
  const tasksOf = clientId => state.tasks.filter(task => task.client_id === clientId);
  const visibleClients = () => state.clients.filter(client => isAdmin() || client.advisor_id === userId);

  function ranking() {
    return state.profiles.filter(profile => profile.role === 'advisor').map(profile => {
      const ids = state.clients.filter(client => client.advisor_id === profile.user_id).map(client => client.id);
      const completed = state.tasks.filter(task => ids.includes(task.client_id) && task.completed_at).length;
      const sold = state.sales.filter(item => item.advisor_id === profile.user_id && item.confirmed);
      return {
        advisor_id: profile.user_id, full_name: profile.full_name, completed_tasks: completed, xp: completed * 10,
        confirmed_sales: sold.length, confirmed_tons: sold.reduce((total, item) => total + Number(item.tons_sold || 0), 0),
      };
    }).sort((a, b) => b.confirmed_sales - a.confirmed_sales || b.xp - a.xp || a.full_name.localeCompare(b.full_name))
      .map((row, index) => ({ ...row, position: index + 1 }));
  }

  function query(table) {
    const filters = [];
    let columns = '*', single = false, insertRow = null, patch = null, max = Infinity;
    const builder = {
      select(value = '*') { columns = value; return builder; },
      eq(column, value) { filters.push(row => row[column] === value); return builder; },
      order() { return builder; },
      limit(value) { max = value; return builder; },
      abortSignal() { return builder; },
      single() { single = true; return builder; },
      insert(row) { insertRow = row; return builder; },
      update(values) { patch = values; return builder; },
      then(resolve, reject) { return Promise.resolve().then(run).then(resolve, reject); },
    };
    const finish = rows => (single ? (rows[0] ? ok(rows[0]) : fail('No se encontró el registro.')) : ok(rows.slice(0, max)));
    function run() {
      if (!signedIn) return fail('Sesión cerrada.');
      if (table === 'mvp_profiles') {
        const rows = state.profiles.filter(row => (isAdmin() || row.user_id === userId) && filters.every(test => test(row)))
          .map(row => Object.assign(row, { progression_sales: state.sales.filter(item => item.advisor_id === row.user_id && item.confirmed).length }));
        if (patch) rows.forEach(row => Object.assign(row, patch));
        return finish(rows.map(row => pick(row, columns)));
      }
      if (table === 'mvp_app_settings') {
        if (patch) { if (!isAdmin()) return fail('Solo el administrador puede cambiar el modo Halloween.'); Object.assign(state.settings, patch); }
        return finish([pick(state.settings, columns === '*' ? 'halloween_enabled' : columns)]);
      }
      if (table === 'mvp_sales') {
        return finish(state.sales.filter(row => isAdmin() || row.advisor_id === userId).map(row => ({ ...row })));
      }
      if (table === 'mvp_clients') {
        if (insertRow) {
          if (!isAdmin()) return fail('Solo el administrador puede crear clientes.');
          const id = `demo-c${state.clients.length + 1}-${Date.now()}`;
          state.clients.unshift({ id, ...insertRow, created_at: new Date().toISOString() });
          TASKS.forEach(([title, description], index) => state.tasks.push({ id: `${id}-t${index + 1}`, client_id: id, title, description, completed_at: null }));
          return ok(null);
        }
        const plain = columns.replace(/,?\s*mvp_tasks\([^)]*\)/, '');
        const rows = visibleClients().filter(row => filters.every(test => test(row)))
          .map(client => ({ ...pick(client, plain), mvp_tasks: tasksOf(client.id).map(task => ({ ...task })) }));
        return finish(rows);
      }
      // Notificaciones y solicitudes de cliente (de main): la demo no tiene, pero responde vacío.
      if (table === 'mvp_notifications' || table === 'mvp_client_requests') return finish([]);
      return fail(`Tabla no disponible en modo demo: ${table}`);
    }
    return builder;
  }

  async function rpc(name, args = {}) {
    if (!signedIn) return fail('Sesión cerrada.');
    switch (name) {
      case 'get_mvp_advisors':
        return isAdmin() ? ok(state.profiles.filter(row => row.role === 'advisor').map(({ user_id, full_name, role: kind, email }) => ({ user_id, full_name, role: kind, email }))) : ok([]);
      case 'get_mvp_advisor_ranking':
        return ok(ranking());
      case 'complete_mvp_task': {
        const task = state.tasks.find(item => item.id === args.target_task && !item.completed_at);
        const owner = task && state.clients.find(client => client.id === task.client_id)?.advisor_id === userId;
        if (!task || !owner) return ok(false);
        task.completed_at = new Date().toISOString();
        return ok(true);
      }
      case 'confirm_mvp_sale': {
        const client = state.clients.find(item => item.id === args.target_client && item.advisor_id === userId);
        if (!client) return fail('El cliente no está asignado a este asesor.');
        if (tasksOf(client.id).filter(task => task.completed_at).length !== 4) return fail('Hay que completar las cuatro tareas.');
        if (state.sales.some(item => item.client_id === client.id && item.confirmed)) return fail('La venta ya está confirmada.');
        const stamp = new Date().toISOString();
        const id = `demo-s-${client.id}`;
        state.sales.push({ id, client_id: client.id, advisor_id: userId, amount: client.tons_requested * 25000, tons_sold: client.tons_requested, completed_at: stamp, confirmed: true, confirmed_at: stamp });
        return ok(id);
      }
      case 'clear_mvp_completed_tasks': {
        const before = state.tasks.length;
        state.tasks = state.tasks.filter(task => !(task.client_id === args.target_client && task.completed_at));
        return ok(before - state.tasks.length);
      }
      case 'reset_mvp_advisor_tasks': {
        if (!isAdmin()) return fail('Solo un administrador puede borrar tareas.');
        const ids = state.clients.filter(client => client.advisor_id === args.target_advisor).map(client => client.id);
        state.tasks = state.tasks.filter(task => !ids.includes(task.client_id));
        return ok(ids.length);
      }
      case 'delete_mvp_advisor_clients':
      case 'delete_mvp_advisor': {
        if (!isAdmin()) return fail('Solo un administrador puede borrar.');
        const ids = state.clients.filter(client => client.advisor_id === args.target_advisor).map(client => client.id);
        state.clients = state.clients.filter(client => !ids.includes(client.id));
        state.tasks = state.tasks.filter(task => !ids.includes(task.client_id));
        state.sales = state.sales.filter(item => !ids.includes(item.client_id));
        if (name === 'delete_mvp_advisor') state.profiles = state.profiles.filter(profile => profile.user_id !== args.target_advisor);
        return ok(name === 'delete_mvp_advisor' ? null : ids.length);
      }
      case 'equip_mvp_skin': {
        if (args.target_skin === 'classic') { me().equipped_skin = 'classic'; return ok('classic'); }
        if (args.target_skin !== 'skeleton') return fail('Ese atuendo no está disponible.');
        if (!state.settings.halloween_enabled) return fail('El modo Halloween no está activo.');
        if (state.sales.filter(item => item.advisor_id === userId && item.confirmed).length < 2) return fail('Necesitas dos ventas confirmadas para equipar este atuendo.');
        me().equipped_skin = 'skeleton';
        return ok('skeleton');
      }
      case 'assign_mvp_client': {
        if (!isAdmin()) return fail('Solo el administrador puede crear clientes.');
        const id = `demo-c${state.clients.length + 1}-${Date.now()}`;
        state.clients.unshift({ id, name: args.client_name, type: args.client_type, advisor_id: args.target_advisor, department: args.target_department, city: args.target_city, tons_requested: args.requested_tons, created_at: new Date().toISOString() });
        TASKS.forEach(([title, description], index) => state.tasks.push({ id: `${id}-t${index + 1}`, client_id: id, title, description, completed_at: null }));
        return ok(id);
      }
      case 'mark_mvp_notification_read':
        return ok(true);
      case 'delete_mvp_own_account':
      case 'request_mvp_commission':
      case 'request_mvp_client':
        return fail(DEMO_ONLY);
      default:
        return fail(`Función no disponible en modo demo: ${name}`);
    }
  }

  return {
    auth: {
      async getUser() { return ok({ user: signedIn ? { id: userId, email: me()?.email } : null }); },
      async signOut() { signedIn = false; return { error: null }; },
      async signInWithPassword() { signedIn = true; return { data: { user: { id: userId } }, error: null }; },
      async signUp() { return { data: null, error: { message: `${DEMO_ONLY} Entra con cualquier correo y contraseña.` } }; },
    },
    from: query,
    rpc,
    // Tiempo real (notificaciones de main): sin red, el canal no emite nada.
    channel() { const channel = { on() { return channel; }, subscribe() { return channel; } }; return channel; },
    async removeChannel() { return 'ok'; },
    storage: {
      from() {
        return {
          async upload() { return fail(DEMO_ONLY); },
          async remove() { return ok([]); },
          async createSignedUrl() { return ok(null); },
        };
      },
    },
    functions: {
      // Sin IA: la sugerencia sale de la primera tarea pendiente que manda la vista.
      async invoke(_name, { body = {} } = {}) {
        const next = body.tasks?.[0]?.title;
        const recommendation = next
          ? `Empieza por «${next}» con ${body.name}: es la siguiente tarea pendiente. (Sugerencia de muestra del modo demo.)`
          : `Las tareas de ${body.name} están al día. Confirma la venta si aún no lo hiciste. (Sugerencia de muestra del modo demo.)`;
        return ok({ recommendation });
      },
    },
  };
}
