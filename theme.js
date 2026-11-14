(() => {
  "use strict";

  const storageKey = "quiet-list:theme";
  const preferences = new Set(["light", "dark"]);
  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = systemTheme.matches ? "dark" : "light";
  let buttons = [];
  let notice = null;
  let ready = false;
  let storageWarning = "";

  function normalizePreference(value) {
    return preferences.has(value)
      ? value
      : systemTheme.matches
        ? "dark"
        : "light";
  }

  function updateControls() {
    for (const button of buttons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.themeOption === preference),
      );
    }

    if (notice) {
      notice.textContent = storageWarning;
      notice.hidden = !storageWarning;
    }
  }

  function updateThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    const color = window
      .getComputedStyle(root)
      .getPropertyValue("--canvas")
      .trim();
    if (meta && color) meta.setAttribute("content", color);
  }

  function applyPreference(value) {
    preference = normalizePreference(value);
    root.dataset.themePreference = preference;
    root.dataset.mode = preference;

    if (ready) {
      updateControls();
      updateThemeColor();
    }
  }

  try {
    preference = normalizePreference(window.localStorage.getItem(storageKey));
  } catch {
    // The system theme still works when browser storage is blocked.
  }
  applyPreference(preference);

  function choosePreference(value) {
    applyPreference(value);

    try {
      window.localStorage.setItem(storageKey, preference);
      storageWarning = "";
    } catch {
      storageWarning =
        "Не удалось сохранить тему. Выбор действует до обновления страницы.";
    }

    updateControls();
  }

  function bindControls() {
    buttons = [...document.querySelectorAll("[data-theme-option]")];
    notice = document.querySelector("#theme-notice");
    ready = true;
    root.classList.add("theme-ready");

    for (const button of buttons) {
      if (!preferences.has(button.dataset.themeOption)) continue;
      button.addEventListener("click", () => {
        choosePreference(button.dataset.themeOption);
      });
    }

    updateControls();
    updateThemeColor();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindControls, { once: true });
  } else {
    bindControls();
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey && event.key !== null) return;

    try {
      if (event.storageArea !== window.localStorage) return;
    } catch {
      return;
    }

    storageWarning = "";
    applyPreference(event.newValue);
  });
})();
