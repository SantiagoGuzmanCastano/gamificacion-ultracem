import { catalog } from './catalog.js';

export function createClient(name) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('Escribe un nombre para crear el cliente.');
  const shuffled = [...catalog];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return {
    id: crypto.randomUUID(), name: name.trim(),
    tasks: shuffled.slice(0, 4).map(({ id, ...content }) => ({
      id: crypto.randomUUID(), templateId: id, ...content, completed: false,
    })),
  };
}

export function completeTask(client, taskId) {
  const task = client.tasks.find(item => item.id === taskId);
  if (!task || task.completed) return false;
  task.completed = true;
  return true;
}

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
