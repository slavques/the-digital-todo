import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_LENGTH,
  parseTasks,
  addTask,
  toggleTask,
  deleteTask,
} from "../model.js";

test("adding trims text without changing the original list", () => {
  const original = [];
  assert.deepEqual(addTask(original, "  Дело  ", "1"), [
    { id: "1", text: "Дело", done: false },
  ]);
  assert.deepEqual(original, []);
});

test("blank and overlong tasks are rejected", () => {
  assert.deepEqual(addTask([], "  ", "1"), []);
  assert.deepEqual(addTask([], "x".repeat(MAX_LENGTH + 1), "1"), []);
});

test("a task at the length boundary is accepted", () => {
  const text = "я".repeat(MAX_LENGTH);
  const tasks = addTask([], text, "1");
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].text, text);
});

test("invalid text and missing or duplicate identifiers cannot create tasks", () => {
  const tasks = addTask([], "Первое дело", "1");
  for (const [text, id] of [
    [null, "2"],
    ["Дело", null],
    ["Дело", " "],
    ["Дело", "1"],
  ]) {
    assert.deepEqual(addTask(tasks, text, id), tasks);
  }
});

test("toggling twice restores the original state without mutating it", () => {
  const tasks = addTask([], "Позвонить", "1");
  const completed = toggleTask(tasks, "1");
  assert.equal(tasks[0].done, false);
  assert.equal(completed[0].done, true);
  assert.deepEqual(toggleTask(completed, "1"), tasks);
});

test("deleting removes only the matching task", () => {
  const tasks = addTask(addTask([], "Первое", "1"), "Второе", "2");
  assert.deepEqual(deleteTask(tasks, "1"), [
    { id: "2", text: "Второе", done: false },
  ]);
  assert.equal(tasks.length, 2);
});

test("text, Unicode and completed status survive a storage round trip", () => {
  const tasks = toggleTask(addTask([], "тест 🪴", "1"), "1");
  assert.deepEqual(parseTasks(JSON.stringify(tasks)), tasks);
});

test("empty storage restores an empty list", () => {
  assert.deepEqual(parseTasks(null), []);
});

test("invalid JSON and a non-array storage value are rejected", () => {
  assert.throws(() => parseTasks("{"));
  assert.throws(() => parseTasks("{}"));
});

test("invalid entries and duplicate identifiers are discarded", () => {
  const raw = JSON.stringify([
    null,
    { id: "1", text: "Правильная запись", done: false, extra: "ignored" },
    { id: "1", text: "Дубликат", done: true },
    { id: "2", text: 3, done: false },
    { id: "3", text: " ", done: false },
    { id: "4", text: "x".repeat(MAX_LENGTH + 1), done: false },
    { id: "5", text: "Неверный статус", done: "true" },
    { id: " ", text: "Пустой идентификатор", done: false },
  ]);
  assert.deepEqual(parseTasks(raw), [
    { id: "1", text: "Правильная запись", done: false },
  ]);
});
