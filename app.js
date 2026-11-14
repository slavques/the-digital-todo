import {
  captureRows,
  animateRows,
  popToast,
  hideToast,
  moveFilter,
  captureStrikes,
  animateStrikes,
  captureRegion,
  animateRegion,
} from "./motion.js";
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
const undoButton = $("#undo-delete");
const filterButtons = [...document.querySelectorAll("[data-filter]")];

let tasks = [];
let filter = "all";
let page = 1;
const PAGE_SIZE = 6;
const region = document.querySelector(".task-region");
let storageAvailable = true;
let lastDeletion = null;
let toastTimer;
const toast = document.querySelector(".feedback");
function dismissToast() {
  if (toast.contains(document.activeElement)) input.focus();
  hideToast(toast, () => {
    toast.dataset.visible = "false";
  });
  clearTimeout(toastTimer);
}
$("#dismiss-notice").addEventListener("click", dismissToast);
toast.addEventListener("pointerenter", () => clearTimeout(toastTimer));
toast.addEventListener("focusin", () => clearTimeout(toastTimer));

function announce(message, kind = "success") {
  notice.textContent = message;
  notice.dataset.kind = kind;
  toast.dataset.kind = kind;
  toast.dataset.visible = "true";
  clearTimeout(toastTimer);
  popToast(toast);
  if (kind !== "error" && !lastDeletion)
    toastTimer = setTimeout(dismissToast, 4500);
}

function clearUndo() {
  if (undoButton === document.activeElement) input.focus();
  lastDeletion = null;
  if (undoButton) undoButton.hidden = true;
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
  item.dataset.id = task.id;
  item.className = `task${task.done ? " completed" : ""}`;

  const label = document.createElement("label");
  label.className = "task-label";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.done;
  checkbox.dataset.taskId = task.id;
  checkbox.addEventListener("change", () => {
    clearUndo();
    tasks = toggleTask(tasks, task.id);
    saveAndRender(
      task.done ? "Задача возвращена в работу." : "Задача выполнена.",
    );
    focusTask(task.id, index);
  });

  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = task.text;
  const copy = document.createElement("span");
  copy.className = "task-copy";
  copy.append(text);
  label.append(checkbox, copy);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove";
  const removeIcon = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  removeIcon.setAttribute("viewBox", "0 0 20 20");
  removeIcon.setAttribute("fill", "none");
  removeIcon.setAttribute("aria-hidden", "true");
  const removePath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  removePath.setAttribute("d", "m6 6 8 8M14 6l-8 8");
  removeIcon.append(removePath);
  remove.append(removeIcon);
  remove.dataset.taskId = task.id;
  remove.setAttribute("aria-label", `Удалить задачу: ${task.text}`);
  remove.addEventListener("click", () => {
    lastDeletion = {
      task,
      index: tasks.findIndex((item) => item.id === task.id),
    };
    tasks = deleteTask(tasks, task.id);
    saveAndRender("Задача удалена.");
    focusTask(null, index);
  });

  item.append(label, remove);
  return item;
}

function render(filterChange = false) {
  const previousHeight = captureRegion(region);
  const strikes = captureStrikes(list);
  const previous = captureRows(list);
  if (undoButton) undoButton.hidden = !lastDeletion;
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

  const filtered = visibleTasks();
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  page = Math.min(page, pages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  renderPagination(filtered.length, pages);
  list.replaceChildren(...visible.map(createTaskElement));
  animateStrikes(list, strikes);
  if (previous.size || visible.length)
    animateRows(list, previous, filterChange);
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
      "Отмечайте сделанное. Оно появится здесь.",
    ],
  };
  $("#empty h3").textContent = emptyMessages[filter][0];
  $("#empty p").textContent = emptyMessages[filter][1];

  for (const button of filterButtons) {
    button.setAttribute("aria-pressed", button.dataset.filter === filter);
  }
  moveFilter();
  animateRegion(region, previousHeight);
}

$("#add-form").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!input.value.trim()) {
    input.setCustomValidity("Напишите задачу, а не только пробелы.");
    input.reportValidity();
    return;
  }

  clearUndo();
  tasks = addTask(tasks, input.value, crypto.randomUUID());
  filter = "all";
  page = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  saveAndRender("Задача добавлена.");
  input.value = "";
  input.focus();
});

input.addEventListener("input", () => input.setCustomValidity(""));

undoButton?.addEventListener("click", () => {
  if (!lastDeletion) return;

  const { task, index } = lastDeletion;
  clearUndo();
  tasks = [...tasks.slice(0, index), task, ...tasks.slice(index)];
  if (!visibleTasks().some((item) => item.id === task.id)) filter = "all";
  page =
    Math.floor(
      visibleTasks().findIndex((item) => item.id === task.id) / PAGE_SIZE,
    ) + 1;
  saveAndRender("Удаление отменено.");
  focusTask(
    task.id,
    visibleTasks().findIndex((item) => item.id === task.id),
  );
});

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    page = 1;
    render(true);
  });
}

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;

  try {
    if (event.storageArea !== localStorage) return;
    clearUndo();

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

function renderPagination(total, pages) {
  $("#pagination").hidden = pages <= 1;
  $("#page-range").textContent = total
    ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} из ${total}`
    : "";
  $("#previous-page").disabled = page === 1;
  $("#next-page").disabled = page === pages;
  const compactPages = matchMedia("(max-width: 480px)").matches;
  const numbers =
    pages <= (compactPages ? 3 : 7)
      ? Array.from({ length: pages }, (_, i) => i + 1)
      : [
          ...new Set(
            compactPages
              ? [1, page, pages]
              : [1, page - 1, page, page + 1, pages],
          ),
        ]
          .filter((n) => n >= 1 && n <= pages)
          .sort((a, b) => a - b);
  const fragment = document.createDocumentFragment();
  numbers.forEach((number, index) => {
    if (index && number > numbers[index - 1] + 1) {
      const gap = document.createElement("span");
      gap.textContent = "…";
      gap.setAttribute("aria-hidden", "true");
      fragment.append(gap);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = number;
    button.setAttribute("aria-label", `Страница ${number}`);
    if (number === page) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => changePage(number));
    fragment.append(button);
  });
  $("#page-list").replaceChildren(fragment);
}
function changePage(number) {
  page = number;
  render(true);
  $('#page-list [aria-current="page"]')?.focus();
  if (region.getBoundingClientRect().top < 0)
    region.scrollIntoView({
      block: "start",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
}
$("#previous-page").addEventListener("click", () => changePage(page - 1));
$("#next-page").addEventListener("click", () => changePage(page + 1));

render();

window.addEventListener("resize", () => {
  const count = visibleTasks().length;
  renderPagination(count, Math.max(1, Math.ceil(count / PAGE_SIZE)));
});
