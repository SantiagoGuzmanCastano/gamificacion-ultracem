// Copia local de public.mvp_levels (migración 20261023200000_advisor_levels.sql).
// tests/levels.test.js comprueba que ambas fuentes coincidan.
export const LEVELS = [
  { level: 1, name: 'Bienvenido al equipo', minSales: 0, reward: 50000 },
  { level: 2, name: 'Primeros resultados', minSales: 1, reward: 100000 },
  { level: 3, name: 'Más clientes, más ventas', minSales: 3, reward: 150000 },
  { level: 4, name: 'Construyendo más oportunidades', minSales: 5, reward: 200000 },
  { level: 5, name: 'Expansión comercial', minSales: 8, reward: 250000 },
  { level: 6, name: 'Líder de tu zona', minSales: 12, reward: 400000 },
  { level: 7, name: 'Maestro comercial', minSales: 16, reward: 600000 },
];
export const MAX_LEVEL = LEVELS.length;

export function levelForSales(sales, levels = LEVELS) {
  const count = Math.max(0, Number(sales) || 0);
  return levels.reduce((reached, item) => count >= item.minSales ? item.level : reached, 1);
}
