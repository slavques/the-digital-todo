import {
  STORAGE_KEY,
  addTask,
  deleteTask,
  parseTasks,
  toggleTask,
} from "./model.js";

const $ = (selector) => document.querySelector(selector);
const input = $("#task-input");
const notice = $("#notice");
const list = $("#tasks");
const filterButtons = [...document.querySelectorAll("[data-filter]")];

let tasks = [];
let filter = "all";
let storageAvailable = true;

function announce(message, kind = "success") {
  notice.textContent = message;
  notice.dataset.kind = kind;
}

try {
  tasks = parseTasks(localStorage.getItem(STORAGE_KEY));
} catch {
  storageAvailable = false;
  announce(
    "Не удалось прочитать сохранённые задачи. Новые изменения могут заменить повреждённые данные.",
    "error",
  );
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    storageAvailable = true;
    return true;
  } catch {
    storageAvailable = false;
    announce(
      "Не удалось сохранить задачи. Они доступны только до закрытия или обновления страницы.",
      "error",
    );
    return false;
  }
}

function visibleTasks() {
  return tasks.filter((task) => {
    if (filter === "all") return true;
    return filter === "done" ? task.done : !task.done;
  });
}

function focusTask(taskId, previousIndex) {
  const checkboxes = [...list.querySelectorAll('input[type="checkbox"]')];
  const sameTask = checkboxes.find(
    (checkbox) => checkbox.dataset.taskId === taskId,
  );
  const nearestTask =
    checkboxes[Math.min(previousIndex, checkboxes.length - 1)];
  const selectedFilter = filterButtons.find(
    (button) => button.dataset.filter === filter,
  );

  (sameTask ?? nearestTask ?? selectedFilter ?? input).focus();
}

function saveAndRender(message) {
  const saved = persist();
  render();
  if (saved) announce(message);
}

function createTaskElement(task, index) {
  const item = document.createElement("li");
  item.className = `task${task.done ? " completed" : ""}`;

  const label = document.createElement("label");
  label.className = "task-label";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.done;
  checkbox.dataset.taskId = task.id;
  checkbox.addEventListener("change", () => {
    tasks = toggleTask(tasks, task.id);
    saveAndRender(
      task.done ? "Задача возвращена в работу." : "Задача выполнена.",
    );
    focusTask(task.id, index);
  });

  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = task.text;
  label.append(checkbox, text);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove";
  remove.textContent = "×";
  remove.dataset.taskId = task.id;
  remove.setAttribute("aria-label", `Удалить задачу: ${task.text}`);
  remove.addEventListener("click", () => {
    tasks = deleteTask(tasks, task.id);
    saveAndRender("Задача удалена.");
    focusTask(null, index);
  });

  item.append(label, remove);
  return item;
}

function render() {
  const completed = tasks.filter((task) => task.done).length;
  const percent = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;
  $("#progress-label").textContent =
    `${completed} из ${tasks.length} выполнено`;
  $("#all-count").textContent = tasks.length;
  $("#progress").style.transform = `scaleX(${percent / 100})`;
  $(".progress-track").setAttribute("aria-valuenow", percent);
  $("#save-label").textContent = storageAvailable
    ? "Сохраняется в этом браузере"
    : "Сохранение недоступно";

  const visible = visibleTasks();
  list.replaceChildren(...visible.map(createTaskElement));
  $("#empty").hidden = visible.length > 0;

  const emptyMessages = {
    all: ["Список пока пуст", "Запишите первое дело в поле выше."],
    active: [
      "Активных задач нет",
      tasks.length
        ? "Все задачи выполнены. Можно добавить следующую."
        : "Добавьте задачу, чтобы начать.",
    ],
    done: [
      "Выполненных задач пока нет",
      "Отмечайте сделанное — оно появится здесь.",
    ],
  };
  $("#empty h3").textContent = emptyMessages[filter][0];
  $("#empty p").textContent = emptyMessages[filter][1];

  for (const button of filterButtons) {
    button.setAttribute("aria-pressed", button.dataset.filter === filter);
  }
}

$("#add-form").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!input.value.trim()) {
    input.setCustomValidity("Напишите задачу, а не только пробелы.");
    input.reportValidity();
    return;
  }

  tasks = addTask(tasks, input.value, crypto.randomUUID());
  filter = "all";
  saveAndRender("Задача добавлена.");
  input.value = "";
  input.focus();
});

input.addEventListener("input", () => input.setCustomValidity(""));

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    render();
  });
}

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;

  try {
    if (event.storageArea !== localStorage) return;

    const focusedTaskId = document.activeElement.dataset.taskId;
    const previousIndex = visibleTasks().findIndex(
      (task) => task.id === focusedTaskId,
    );
    tasks = parseTasks(event.newValue);
    storageAvailable = true;
    render();
    announce("Список обновлён в другой вкладке.");
    if (focusedTaskId) focusTask(focusedTaskId, previousIndex);
  } catch {
    announce("Не удалось прочитать изменения из другой вкладки.", "error");
  }
});

render();
