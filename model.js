export const STORAGE_KEY = 'quiet-list:v1';
export const MAX_LENGTH = 300;
export function parseTasks(raw) {
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('Invalid storage');
  const ids = new Set();
  return value.filter(t => {
    if (!t || typeof t.id !== 'string' || ids.has(t.id) || typeof t.text !== 'string' || !t.text.trim() || t.text.length > MAX_LENGTH || typeof t.done !== 'boolean') return false;
    ids.add(t.id); return true;
  }).map(({id, text, done}) => ({id, text, done}));
}
export function addTask(tasks, text, id) {
  const clean = text.trim();
  if (!clean || clean.length > MAX_LENGTH) return tasks;
  return [...tasks, {id, text: clean, done: false}];
}
export const toggleTask = (tasks, id) => tasks.map(t => t.id === id ? {...t, done: !t.done} : t);
export const deleteTask = (tasks, id) => tasks.filter(t => t.id !== id);
