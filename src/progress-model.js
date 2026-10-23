import { LEVELS } from './levels.js';
import { getLevelProgress } from './game.js';

// Server rows (public.mvp_levels) win over the local copy when they are available.
export function getProgressModel(storedLevel, progressionSales, serverLevels = []) {
  const progress = getLevelProgress(storedLevel, progressionSales);
  const byLevel = new Map(serverLevels.map(row => [Number(row.level), row]));
  const levels = LEVELS.map(item => {
    const row = byLevel.get(item.level);
    const merged = row ? { ...item, name: row.name, minSales: Number(row.min_confirmed_sales), reward: Number(row.reward_amount) } : item;
    return { ...merged, state: item.level < progress.level ? 'completed' : item.level === progress.level ? 'current' : 'locked' };
  });
  const current = levels[progress.level - 1];
  const next = levels[progress.level] ?? null;
  return { ...progress, levels, current, next, remaining: next ? Math.max(0, next.minSales - progress.sales) : 0 };
}
