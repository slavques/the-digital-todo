export const STORAGE_KEY = "quiet-list:v1";
export const MAX_LENGTH = 300;

export function parseTasks(raw) {
  if (!raw) return [];

  const value = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("Invalid storage");

  const ids = new Set();
  return value
    .filter((task) => {
      if (
        !task ||
        typeof task.id !== "string" ||
        !task.id.trim() ||
        ids.has(task.id) ||
        typeof task.text !== "string" ||
        !task.text.trim() ||
        task.text.length > MAX_LENGTH ||
        typeof task.done !== "boolean"
      ) {
        return false;
      }

      ids.add(task.id);
      return true;
    })
    .map(({ id, text, done }) => ({ id, text, done }));
}

export function addTask(tasks, text, id) {
  if (
    typeof text !== "string" ||
    typeof id !== "string" ||
    !id.trim() ||
    tasks.some((task) => task.id === id)
  ) {
    return tasks;
  }

  const clean = text.trim();
  if (!clean || clean.length > MAX_LENGTH) return tasks;

  return [...tasks, { id, text: clean, done: false }];
}

export function toggleTask(tasks, id) {
  return tasks.map((task) =>
    task.id === id ? { ...task, done: !task.done } : task,
  );
}

export function deleteTask(tasks, id) {
  return tasks.filter((task) => task.id !== id);
}
