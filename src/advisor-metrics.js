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

  for (const sale of confirmedSales(sales, advisorId)) {
    const day = startOfLocalDay(sale.confirmed_at);
    const index = Math.round((day - monday) / DAY_MS);
    if (index >= 0 && index < 7) counts[index] += 1;
  }

  return WEEK_LABELS.map((label, index) => ({
    label,
    count: counts[index],
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
