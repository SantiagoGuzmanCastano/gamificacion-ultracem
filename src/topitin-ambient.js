// Lo que Topitín dice solo, de vez en cuando, en Inicio. Funciones puras para poder probarlas.

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const cop = value => `$ ${Math.round(Number(value) || 0).toLocaleString('es-CO')}`;

// Por qué está triste (0–1 de 4 tareas) o serio (2–3 de 4). Feliz no necesita explicarse.
export function moodReasons({ mood, completed = 0, total = 4, client = '' }) {
  if (mood === 'happy' || !client || !total) return [];
  const left = total - completed;
  if (mood === 'sad') return completed === 0
    ? [
      `Estoy triste: aún no empezamos las tareas de ${client}. ¿Arrancamos con la primera?`,
      `${client} nos está esperando… con cada tarea que hagamos me voy a sentir mejor.`,
      `Me faltan ${plural(left, 'tarea', 'tareas')} por completar con ${client}. Por eso ando cabizbajo.`,
    ]
    : [
      `Solo llevamos ${completed} de ${total} tareas con ${client}… me faltan ${left} para estar feliz.`,
      `Ando un poco triste: quedan ${plural(left, 'tarea', 'tareas')} con ${client}. Con la siguiente me voy a sentir mejor.`,
    ];
  return left === 1
    ? [
      `Estoy serio porque solo falta 1 tarea con ${client}. ¡Termínala y me pongo feliz!`,
      `Concentrado: a ${client} le queda 1 tarea para confirmar la venta.`,
    ]
    : [
      `Estoy serio: vamos a mitad de camino con ${client} (${completed} de ${total}). ¡Concentrados!`,
      `Enfocado: quedan ${plural(left, 'tarea', 'tareas')} con ${client} para cerrar la venta.`,
    ];
}

// Pendientes: comisiones por reclamar y un nivel nuevo que aún no se ha visto en Progreso.
export function pendingReminders({ claimable = 0, claimableAmount = 0, newLevel = false }) {
  const lines = [];
  if (claimable) lines.push(`Tienes ${claimableAmount ? cop(claimableAmount) : plural(claimable, 'comisión', 'comisiones')} por reclamar. ¡Pásate por Cartera de comisiones!`);
  if (newLevel) lines.push('¡Subiste de nivel y aún no lo has visto! Mira tu nueva isla en Progreso.');
  return lines;
}

export function notificationReminders({ unread = 0 }) {
  return unread
    ? [`Tienes ${plural(unread, 'notificación', 'notificaciones')} sin leer. ¡Dale un vistazo a la campana!`]
    : ['Recuerda revisar tus notificaciones de vez en cuando: ahí te aviso de clientes nuevos.'];
}

// Elige la próxima frase: los pendientes pesan más; nunca repite la anterior si hay otra opción.
// Con `always`, el recordatorio de notificaciones entra siempre: así nunca se queda callado.
export function nextAmbientLine(context, previous = '', random = Math.random, { always = false } = {}) {
  const pool = [
    ...pendingReminders(context), ...pendingReminders(context),
    ...moodReasons(context),
    ...(always || random() < .35 ? notificationReminders(context) : []),
  ];
  const options = pool.filter(line => line !== previous);
  const list = options.length ? options : pool;
  return list.length ? list[Math.floor(random() * list.length)] : '';
}
