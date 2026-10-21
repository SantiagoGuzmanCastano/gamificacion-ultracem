export function getMascotState(percentage) {
  if (percentage === 0) return 'sad';
  if (percentage < 100) return 'neutral';
  return 'happy';
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

const cheers = ['¡Excelente trabajo!', '¡Vas con todo!', '¡Una más!', '¡Lo lograste!'];

export function getMascotCheer(completedTasks) {
  return cheers[Math.min(cheers.length, Math.max(1, completedTasks)) - 1];
}
