import { LEVELS, MAX_LEVEL, levelForSales } from './levels.js';

export function getMascotState(percentage) {
  if (percentage === 0) return 'sad';
  if (percentage < 100) return 'neutral';
  return 'happy';
}

export function getMascotStateForCurrentClient(client) {
  return client ? getProgress(client.tasks).mascot : 'happy';
}

export function getProgress(tasks) {
  const completed = tasks.filter(task => task.completed).length;
  const total = tasks.length;
  const percentage = total ? completed / total * 100 : 0;
  return {
    completed,
    total,
    percentage,
    rounded: Math.round(percentage),
    mascot: getMascotState(percentage),
    isLastTaskPending: total === 4 && completed === 3,
  };
}

export function getXp(completedTasks) {
  return Math.max(0, completedTasks) * 10;
}

// The level follows confirmed sales; a stored level only wins if it is already higher.
export function getLevelProgress(level = 1, progressionSales = 0) {
  const sales = Math.max(0, Number(progressionSales) || 0);
  const currentLevel = Math.min(MAX_LEVEL, Math.max(1, Number(level) || 1, levelForSales(sales)));
  const floor = LEVELS[currentLevel - 1].minSales;
  const target = LEVELS[currentLevel]?.minSales ?? null;
  return {
    level: currentLevel,
    sales,
    target,
    percentage: target ? Math.min(100, Math.max(0, Math.round((sales - floor) / (target - floor) * 100))) : 100,
  };
}

export function isTaskCompletionConfirmed(result) {
  return result?.error == null && result?.data === true;
}

export function shouldShowEncouragement(completedTasks) {
  return completedTasks > 0 && completedTasks % 2 === 0;
}
