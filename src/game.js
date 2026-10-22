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

export function isTaskCompletionConfirmed(result) {
  return result?.error == null && result?.data === true;
}

export function shouldShowEncouragement(completedTasks) {
  return completedTasks > 0 && completedTasks % 2 === 0;
}
