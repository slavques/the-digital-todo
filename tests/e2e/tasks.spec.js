import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const storageKey = "quiet-list:v1";
const pageErrors = new WeakMap();

test.beforeEach(({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});

test.afterEach(({ page }) => {
  expect(pageErrors.get(page), "No uncaught browser errors").toEqual([]);
});

async function addTask(page, text) {
  await page.locator("#task-input").fill(text);
  await page.locator("#task-input").press("Enter");
}

test("adding, completing, reopening and deleting survive a reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".task")).toHaveCount(0);

  await page.locator("#task-input").fill("  Купить молоко  ");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.locator(".task-text")).toHaveText("Купить молоко");
  await page.reload();
  await expect(page.locator(".task-text")).toHaveText("Купить молоко");

  await page
    .getByRole("checkbox", { name: "Купить молоко", exact: true })
    .check();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Купить молоко", exact: true }),
  ).toBeChecked();
  await expect(page.locator("#progress-label")).toHaveText("1 из 1 выполнено");

  await page
    .getByRole("checkbox", { name: "Купить молоко", exact: true })
    .uncheck();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Купить молоко", exact: true }),
  ).not.toBeChecked();

  await page
    .getByRole("button", { name: "Удалить задачу: Купить молоко", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".task")).toHaveCount(0);
  await expect(page.locator("#empty")).toBeVisible();
});

test("blank input is rejected and the 300-character limit is enforced", async ({
  page,
}) => {
  await page.goto("/");
  await addTask(page, "   ");
  await expect(page.locator(".task")).toHaveCount(0);
  expect(
    await page.locator("#task-input").evaluate((input) => input.validity.valid),
  ).toBe(false);

  const text = "я".repeat(300);
  await page.locator("#task-input").fill(text);
  await page.locator("#task-input").press("End");
  await page.locator("#task-input").press("a");
  await expect(page.locator("#task-input")).toHaveValue(text);
  await page.locator("#task-input").press("Enter");
  await expect(page.locator(".task-text")).toHaveText(text);
});

test("task text cannot create HTML or execute an event handler", async ({
  page,
}) => {
  await page.goto("/");
  const text = "<img src=x onerror=alert(1)>";
  await addTask(page, text);
  await expect(page.locator(".task-text")).toHaveText(text);
  await expect(page.locator("#tasks img")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".task-text")).toHaveText(text);
});

test("filters preserve keyboard focus when tasks leave the current view", async ({
  page,
}) => {
  await page.goto("/");
  await addTask(page, "Первое дело");
  await addTask(page, "Второе дело");
  const activeFilter = page.locator('[data-filter="active"]');
  const doneFilter = page.locator('[data-filter="done"]');

  await activeFilter.click();
  await page
    .getByRole("checkbox", { name: "Первое дело", exact: true })
    .press("Space");
  await expect(page.locator(".task")).toHaveCount(1);
  await expect(
    page.getByRole("checkbox", { name: "Второе дело", exact: true }),
  ).toBeFocused();

  await page
    .getByRole("checkbox", { name: "Второе дело", exact: true })
    .press("Space");
  await expect(page.locator(".task")).toHaveCount(0);
  await expect(activeFilter).toBeFocused();

  await doneFilter.click();
  await expect(page.locator(".task")).toHaveCount(2);
  await page
    .getByRole("checkbox", { name: "Первое дело", exact: true })
    .press("Space");
  await expect(
    page.getByRole("checkbox", { name: "Второе дело", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("checkbox", { name: "Второе дело", exact: true })
    .press("Space");
  await expect(page.locator(".task")).toHaveCount(0);
  await expect(doneFilter).toBeFocused();
});

test("deleting a task keeps focus on the next available task", async ({
  page,
}) => {
  await page.goto("/");
  await addTask(page, "Первое дело");
  await addTask(page, "Второе дело");
  await page
    .getByRole("button", { name: "Удалить задачу: Первое дело", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Второе дело", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Удалить задачу: Второе дело", exact: true })
    .click();
  await expect(page.locator('[data-filter="all"]')).toBeFocused();
});

test("a malformed saved list shows a warning and can be replaced by a new task", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate((key) => localStorage.setItem(key, "{"), storageKey);
  await page.reload();
  await expect(page.locator(".task")).toHaveCount(0);
  await expect(page.locator("#notice")).toContainText("Не удалось");

  await addTask(page, "Новый список");
  await expect(page.locator("#notice")).not.toContainText("Не удалось");
  await page.reload();
  await expect(page.locator(".task-text")).toHaveText("Новый список");
});

test("unavailable storage still allows working with tasks in memory", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage denied", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await addTask(page, "Задача в памяти");
  await expect(page.locator(".task-text")).toHaveText("Задача в памяти");
  await expect(page.locator("#save-label")).toContainText("недоступно");
  await expect(page.locator("#notice")).toContainText("Не удалось сохранить");
  await page.reload();
  await expect(page.locator(".task")).toHaveCount(0);
});

test("a write failure remains visible until saving succeeds again", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.__originalStorageSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await addTask(page, "Не потерять предупреждение");
  await expect(page.locator("#notice")).toContainText("Не удалось сохранить");
  await page.locator('[data-filter="active"]').click();
  await expect(page.locator("#notice")).toContainText("Не удалось сохранить");

  await page.evaluate(() => {
    Storage.prototype.setItem = window.__originalStorageSetItem;
    delete window.__originalStorageSetItem;
  });
  await page
    .getByRole("checkbox", { name: "Не потерять предупреждение", exact: true })
    .press("Space");
  await expect(page.locator(".task")).toHaveCount(0);
  await expect(page.locator('[data-filter="active"]')).toBeFocused();
  await expect(page.locator("#notice")).not.toContainText(
    "Не удалось сохранить",
  );
  await expect(page.locator("#save-label")).not.toContainText("недоступно");
  await page.reload();
  await expect(
    page.getByRole("checkbox", {
      name: "Не потерять предупреждение",
      exact: true,
    }),
  ).toBeChecked();
});

test("changes and clearing storage are synchronized between tabs", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  await addTask(other, "Общая задача");
  await expect(page.locator(".task-text")).toHaveText("Общая задача");

  await page
    .getByRole("checkbox", { name: "Общая задача", exact: true })
    .check();
  await expect(
    other.getByRole("checkbox", { name: "Общая задача", exact: true }),
  ).toBeChecked();
  await other
    .getByRole("button", { name: "Удалить задачу: Общая задача", exact: true })
    .click();
  await expect(page.locator(".task")).toHaveCount(0);

  await addTask(other, "Очистить список");
  await expect(page.locator(".task")).toHaveCount(1);
  await other.evaluate(() => localStorage.clear());
  await expect(page.locator(".task")).toHaveCount(0);
  await other.close();
});

test("long task text does not cause horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await addTask(page, "ОченьДлинноеСлово".repeat(18));
  for (const width of [320, 375, 768, 1280]) {
    await test.step(`${width}px viewport`, async () => {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(page.locator(".task-text")).toBeVisible();
    });
  }
});

test("empty and populated views pass automated WCAG A/AA checks", async ({
  page,
}) => {
  await page.goto("/");
  const scan = () =>
    new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
  expect((await scan()).violations).toEqual([]);

  await addTask(page, "Проверить доступность");
  await page
    .getByRole("checkbox", { name: "Проверить доступность", exact: true })
    .check();
  expect((await scan()).violations).toEqual([]);
});
