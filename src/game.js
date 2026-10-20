export function getMascotState(percentage) {
  if (percentage <= 25) return 'sad';
  if (percentage <= 50) return 'neutral';
  if (percentage <= 75) return 'happy';
  return 'energetic';
}

export function getProgress(tasks) {
  const completed = tasks.filter(task => task.completed).length;
  const total = tasks.length;
  const percentage = total ? completed / total * 100 : 0;
  return { completed, total, percentage, rounded: Math.round(percentage), mascot: getMascotState(percentage) };
}
