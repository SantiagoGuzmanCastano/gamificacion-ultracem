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

export function getLevelProgress(level = 1, progressionSales = 0) {
  const currentLevel = Math.min(3, Math.max(1, Number(level) || 1));
  const sales = Math.max(0, Number(progressionSales) || 0);
  const target = currentLevel === 1 ? 1 : currentLevel === 2 ? 5 : null;
  return {
    level: currentLevel,
    sales,
    target,
    percentage: target ? Math.min(100, Math.round((sales / target) * 100)) : 100,
  };
}

export function isTaskCompletionConfirmed(result) {
  return result?.error == null && result?.data === true;
}

export function shouldShowEncouragement(completedTasks) {
  return completedTasks > 0 && completedTasks % 2 === 0;
}
