import { STORAGE_KEY, parseTasks, addTask, toggleTask, deleteTask } from './model.js';
const $ = selector => document.querySelector(selector);
let tasks = [], filter = 'all', storageAvailable = true;
try { tasks = parseTasks(localStorage.getItem(STORAGE_KEY)); }
catch { storageAvailable = false; $('#notice').textContent = 'Не удалось прочитать сохранённые задачи. Новые изменения могут заменить повреждённые данные.'; }
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); storageAvailable = true; }
  catch { storageAvailable = false; $('#notice').textContent = 'Не удалось сохранить задачи. Они доступны только до закрытия или обновления страницы.'; }
}
function render() {
  const done = tasks.filter(t => t.done).length;
  $('#progress-label').textContent = `${done} из ${tasks.length} выполнено`;
  $('#all-count').textContent = tasks.length;
  const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  $('#progress').style.width = `${percent}%`;
  $('.progress-track').setAttribute('aria-valuenow', percent);
  $('#save-label').textContent = storageAvailable ? 'Сохраняется в этом браузере' : 'Сохранение недоступно';
  const visible = tasks.filter(t => filter === 'all' || (filter === 'done' ? t.done : !t.done));
  $('#tasks').replaceChildren(...visible.map(task => {
    const li = document.createElement('li'); li.className = `task${task.done ? ' completed' : ''}`;
    const label = document.createElement('label'); label.className = 'task-label';
    const checkbox = document.createElement('input'); checkbox.dataset.taskId = task.id; checkbox.type = 'checkbox'; checkbox.checked = task.done;
    const text = document.createElement('span'); text.className = 'task-text'; text.textContent = task.text;
    checkbox.addEventListener('change', () => { tasks = toggleTask(tasks, task.id); persist(); render(); Array.from(document.querySelectorAll('.task input')).find(el => el.dataset.taskId === task.id)?.focus(); });
    label.append(checkbox, text);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove'; remove.textContent = '×'; remove.setAttribute('aria-label', `Удалить задачу: ${task.text}`);
    remove.addEventListener('click', () => { tasks = deleteTask(tasks, task.id); persist(); render(); $('#task-input').focus(); if (storageAvailable) $('#notice').textContent = 'Задача удалена.'; });
    li.append(label, remove); return li;
  }));
  $('#empty').hidden = visible.length > 0;
  $('#empty h3').textContent = filter === 'all' ? 'Начните с малого' : filter === 'active' ? 'Всё сделано' : 'Здесь будут ваши победы';
  $('#empty p').textContent = filter === 'all' ? 'Добавьте первое дело. Остальное по порядку.' : filter === 'active' ? 'Можно выдохнуть. Или записать следующую идею.' : 'Отметьте выполненную задачу, и она появится здесь.';
  document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', b.dataset.filter === filter));
}
$('#add-form').addEventListener('submit', event => {
  event.preventDefault(); const input = $('#task-input');
  if (!input.value.trim()) { input.setCustomValidity('Напишите задачу, а не только пробелы.'); input.reportValidity(); return; }
  tasks = addTask(tasks, input.value, crypto.randomUUID()); filter = 'all'; persist(); render(); input.value = ''; input.focus();
  if (storageAvailable) $('#notice').textContent = 'Задача добавлена.';
});
$('#task-input').addEventListener('input', event => event.target.setCustomValidity(''));
document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.filter; render(); }));
window.addEventListener('storage', event => { if (event.key === STORAGE_KEY || event.key === null) { try { tasks = parseTasks(event.newValue); render(); } catch { $('#notice').textContent = 'Не удалось прочитать изменения из другой вкладки.'; } } });
render();
