const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function getRankingSlots(rows) {
  return [...rows, ...Array.from({ length: Math.max(0, 3 - rows.length) }, (_, index) => ({
    position: rows.length + index + 1, full_name: 'Falta un asesor', placeholder: true,
  }))];
}

export function getClientSaleState(client, sales) {
  if (sales.some(sale => sale.client_id === client.id && sale.confirmed)) return 'confirmed';
  return client.tasks.length === 4 && client.tasks.every(task => task.completed) ? 'ready' : 'pending';
}

export function getClientHistoryStatus(client, sales) {
  const completed = client.tasks.filter(task => task.completed).length;
  const percentage = client.tasks.length ? Math.round(completed / client.tasks.length * 100) : 0;
  const state = getClientSaleState(client, sales);
  return {
    label: state === 'confirmed' ? 'Venta confirmada' : state === 'ready' ? 'Listo para venta' : 'Pendiente',
    percentage,
    current: state !== 'confirmed',
  };
}

export function isCurrentClient(client, sales) {
  return getClientHistoryStatus(client, sales).current;
}

export function getPortfolioProgress(clients, sales) {
  const tasks = clients.flatMap(client => client.tasks);
  const completed = tasks.filter(task => task.completed).length;
  return {
    completed, total: tasks.length, percentage: tasks.length ? Math.round(completed / tasks.length * 100) : 0,
    readyClients: clients.filter(client => getClientSaleState(client, sales) === 'ready').length,
  };
}

export function getMonthlyGoal(tons, target = 100) {
  const percentage = Math.round(tons / target * 100);
  return { percentage, fill: Math.min(100, percentage) };
}

function localDayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function confirmedSales(sales, advisorId) {
  return sales.filter(sale => sale.confirmed && sale.advisor_id === advisorId && localDayKey(sale.confirmed_at));
}

function startOfLocalDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getMonthlyTons(sales, advisorId, now = new Date()) {
  const current = new Date(now);
  return confirmedSales(sales, advisorId)
    .filter(sale => {
      const date = new Date(sale.confirmed_at);
      return date.getFullYear() === current.getFullYear() && date.getMonth() === current.getMonth();
    })
    .reduce((total, sale) => total + Number(sale.tons_sold || 0), 0);
}

export function getWeeklySales(sales, advisorId, now = new Date()) {
  const today = startOfLocalDay(now);
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);
  const counts = Array(7).fill(0);
  const tons = Array(7).fill(0);

  for (const sale of confirmedSales(sales, advisorId)) {
    const day = startOfLocalDay(sale.confirmed_at);
    const index = Math.round((day - monday) / DAY_MS);
    if (index >= 0 && index < 7) {
      counts[index] += 1;
      tons[index] += Number(sale.tons_sold || 0);
    }
  }

  return WEEK_LABELS.map((label, index) => ({
    label,
    count: counts[index],
    tons: tons[index],
    date: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index),
  }));
}

export function getSalesStreak(sales, advisorId, now = new Date()) {
  const daysWithSales = new Set(confirmedSales(sales, advisorId).map(sale => localDayKey(sale.confirmed_at)));
  const cursor = startOfLocalDay(now);
  let streak = 0;

  while (daysWithSales.has(localDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function getTodaySales(sales, advisorId, now = new Date()) {
  const today = localDayKey(now);
  const list = confirmedSales(sales, advisorId).filter(sale => localDayKey(sale.confirmed_at) === today);
  return { count: list.length, tons: list.reduce((total, sale) => total + Number(sale.tons_sold || 0), 0) };
}

// Cuántas ventas faltan para subir un puesto o, si va de primero, cuánta ventaja lleva.
export function getRankingGap(rows, advisorId) {
  const own = rows.find(row => row.advisor_id === advisorId);
  if (!own) return null;
  const sold = Number(own.confirmed_sales || 0);
  if (own.position === 1) {
    const next = rows.find(row => row.position === 2);
    return { kind: 'lead', value: Math.max(0, sold - Number(next?.confirmed_sales || 0)) };
  }
  const ahead = rows.find(row => row.position === own.position - 1);
  if (!ahead) return null;
  return { kind: 'climb', target: own.position - 1, value: Math.max(1, Number(ahead.confirmed_sales || 0) - sold + 1) };
}
