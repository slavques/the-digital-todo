import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const storageKey = "quiet-list:v1";
const themeStorageKey = "quiet-list:theme";
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

async function expectTheme(page, preference, mode) {
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-preference",
    preference,
  );
  await expect(page.locator("html")).toHaveAttribute("data-mode", mode);
  await expect(
    page.locator(`[data-theme-option="${preference}"]`),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator('[data-theme-option][aria-pressed="true"]'),
  ).toHaveCount(1);
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

test("undo restores a deleted task and expires after subsequent list changes", async ({
  page,
  context,
}) => {
  const undo = page.locator("#undo-delete");
  await page.goto("/");
  await addTask(page, "Первое дело");
  await addTask(page, "Дело в середине");
  await addTask(page, "Последнее дело");
  const middleTask = page.getByRole("checkbox", {
    name: "Дело в середине",
    exact: true,
  });
  await middleTask.check();

  await test.step("restore the completed middle task at its original position", async () => {
    await page
      .getByRole("button", {
        name: "Удалить задачу: Дело в середине",
        exact: true,
      })
      .click();
    await expect(page.locator(".task-text")).toHaveText([
      "Первое дело",
      "Последнее дело",
    ]);
    await expect(undo).toBeVisible();
    await expect(undo).toHaveAccessibleName("Отменить удаление");
    await undo.click();
    await expect(page.locator(".task-text")).toHaveText([
      "Первое дело",
      "Дело в середине",
      "Последнее дело",
    ]);
    await expect(middleTask).toBeChecked();
    await expect(middleTask).toBeFocused();
    await expect(undo).toBeHidden();

    await page.reload();
    await expect(page.locator(".task-text")).toHaveText([
      "Первое дело",
      "Дело в середине",
      "Последнее дело",
    ]);
    await expect(middleTask).toBeChecked();
    await expect(undo).toBeHidden();
  });

  await test.step("adding or toggling a task clears the last deletion", async () => {
    await page
      .getByRole("button", {
        name: "Удалить задачу: Дело в середине",
        exact: true,
      })
      .click();
    await expect(undo).toBeVisible();
    await addTask(page, "Новое дело");
    await expect(undo).toBeHidden();

    await page
      .getByRole("button", {
        name: "Удалить задачу: Новое дело",
        exact: true,
      })
      .click();
    await expect(undo).toBeVisible();
    await page
      .getByRole("checkbox", { name: "Первое дело", exact: true })
      .check();
    await expect(undo).toBeHidden();
  });

  await test.step("an external list update and a reload clear pending undo", async () => {
    await page
      .getByRole("button", {
        name: "Удалить задачу: Последнее дело",
        exact: true,
      })
      .click();
    await expect(undo).toBeVisible();
    const other = await context.newPage();
    await other.goto("/");
    await addTask(other, "Дело из другой вкладки");
    await expect(page.locator(".task-text")).toHaveText([
      "Первое дело",
      "Дело из другой вкладки",
    ]);
    await expect(undo).toBeHidden();
    await other.close();

    await page
      .getByRole("button", {
        name: "Удалить задачу: Дело из другой вкладки",
        exact: true,
      })
      .click();
    await expect(undo).toBeVisible();
    await page.reload();
    await expect(undo).toBeHidden();
    await expect(page.locator(".task-text")).toHaveText("Первое дело");
    await expect(
      page.getByRole("checkbox", { name: "Первое дело", exact: true }),
    ).toBeChecked();
  });
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

test("the system preference follows the initial and changing system theme", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expectTheme(page, "system", "dark");
  await expect(
    page.getByRole("button", { name: "Как в системе", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const darkBackground = await page.locator("body").evaluate((element) => {
    return getComputedStyle(element).backgroundColor;
  });

  await page.emulateMedia({ colorScheme: "light" });
  await expectTheme(page, "system", "light");
  await expect
    .poll(() =>
      page.locator("body").evaluate((element) => {
        return getComputedStyle(element).backgroundColor;
      }),
    )
    .not.toBe(darkBackground);

  await page.emulateMedia({ colorScheme: "dark" });
  await expectTheme(page, "system", "dark");
});

for (const [preference, label, opposite] of [
  ["light", "Светлая", "dark"],
  ["dark", "Тёмная", "light"],
]) {
  test(`the explicit ${preference} theme persists without changing tasks`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: opposite });
    await page.goto("/");
    await addTask(page, "Сохранить дело при смене темы");
    await page
      .getByRole("checkbox", {
        name: "Сохранить дело при смене темы",
        exact: true,
      })
      .check();
    await page.getByRole("button", { name: label, exact: true }).press("Enter");
    await expectTheme(page, preference, preference);

    await page.emulateMedia({ colorScheme: preference });
    await page.emulateMedia({ colorScheme: opposite });
    await expectTheme(page, preference, preference);
    await expect(page.locator(".task-text")).toHaveText(
      "Сохранить дело при смене темы",
    );

    await page.reload();
    await expectTheme(page, preference, preference);
    await expect(
      page.getByRole("checkbox", {
        name: "Сохранить дело при смене темы",
        exact: true,
      }),
    ).toBeChecked();
    await expect(page.locator("#progress-label")).toHaveText(
      "1 из 1 выполнено",
    );

    await page
      .getByRole("button", { name: "Как в системе", exact: true })
      .click();
    await expectTheme(page, "system", opposite);
    await page.reload();
    await expectTheme(page, "system", opposite);
    await expect(page.locator(".task-text")).toHaveText(
      "Сохранить дело при смене темы",
    );
  });
}

test("a blocked theme store still allows selection and does not affect task storage", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (name) {
      if (name === key)
        throw new DOMException("Storage denied", "SecurityError");
      return originalGetItem.call(this, name);
    };
    Storage.prototype.setItem = function (name, value) {
      if (name === key)
        throw new DOMException("Storage denied", "SecurityError");
      return originalSetItem.call(this, name, value);
    };
  }, themeStorageKey);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expectTheme(page, "system", "dark");

  await page.getByRole("button", { name: "Светлая", exact: true }).click();
  await expectTheme(page, "light", "light");
  await expect(page.locator("#theme-notice")).toContainText(
    "Не удалось сохранить тему",
  );
  await addTask(page, "Задачи сохраняются независимо от темы");
  await expect(page.locator("#theme-notice")).toContainText(
    "Не удалось сохранить тему",
  );
  await page.getByRole("button", { name: "Тёмная", exact: true }).click();
  await expectTheme(page, "dark", "dark");

  await page.reload();
  await expectTheme(page, "system", "dark");
  await expect(page.locator(".task-text")).toHaveText(
    "Задачи сохраняются независимо от темы",
  );
});

test("theme selection is synchronized between tabs without clearing tasks", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await addTask(page, "Не менять задачи вместе с темой");
  const other = await context.newPage();
  await other.emulateMedia({ colorScheme: "dark" });
  await other.goto("/");
  await expectTheme(other, "system", "dark");

  await other.getByRole("button", { name: "Светлая", exact: true }).click();
  await expectTheme(other, "light", "light");
  await expectTheme(page, "light", "light");
  await expect(page.locator(".task-text")).toHaveText(
    "Не менять задачи вместе с темой",
  );

  await page.getByRole("button", { name: "Тёмная", exact: true }).click();
  await expectTheme(other, "dark", "dark");
  await expectTheme(page, "dark", "dark");
  await expect(other.locator(".task-text")).toHaveText(
    "Не менять задачи вместе с темой",
  );

  await other.evaluate((key) => localStorage.removeItem(key), themeStorageKey);
  await expectTheme(page, "system", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expectTheme(page, "system", "light");
  await expect(page.locator(".task-text")).toHaveText(
    "Не менять задачи вместе с темой",
  );
  await other.close();
});

for (const mode of ["light", "dark"]) {
  test(`the ${mode} empty and populated views pass automated WCAG A/AA checks`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator(`[data-theme-option="${mode}"]`).click();
    await expectTheme(page, mode, mode);
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
}
