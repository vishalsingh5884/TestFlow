const THEME_STORAGE_KEY = "testflow_student_theme";

export const THEMES = {
  dark: "dark",
  light: "light",
  system: "system",
};

export function normalizeTheme(theme) {
  const value = String(theme || "").toLowerCase().trim();

  if (value === "light") return "light";
  if (value === "system") return "system";

  return "dark";
}

export function getStoredTheme() {
  try {
    return normalizeTheme(
      localStorage.getItem(THEME_STORAGE_KEY) || "dark"
    );
  } catch {
    return "dark";
  }
}

export function applyGlobalTheme(theme) {
  const activeTheme = normalizeTheme(theme);

  const root = document.documentElement;
  const body = document.body;

  /*
   * Remove every previous TESTFLOW theme.
   */
  [
    "settings-dark",
    "settings-light",
    "settings-system",
    "theme-dark",
    "theme-light",
    "theme-system",
  ].forEach((className) => {
    root.classList.remove(className);
    body.classList.remove(className);
  });

  /*
   * Add active theme to BOTH html and body.
   *
   * This is important because some pages are rendered
   * outside the StudentDashboard wrapper.
   */
  root.classList.add(`settings-${activeTheme}`);
  body.classList.add(`settings-${activeTheme}`);

  root.classList.add(`theme-${activeTheme}`);
  body.classList.add(`theme-${activeTheme}`);

  root.setAttribute("data-theme", activeTheme);
  body.setAttribute("data-theme", activeTheme);

  /*
   * Global CSS variables.
   */
  const themes = {
    dark: {
      bg: "#071411",
      surface: "#0b211a",
      card: "#0d2d24",
      text: "#f4f7f5",
      muted: "#8ea9a0",
      primary: "#10b981",
      accent: "#e7be68",
      danger: "#dc2626",
      border: "#1b4033",
      pink: "#0b211a",
    },

    light: {
      bg: "#ffffff",
      surface: "#fff7f8",
      card: "#ffffff",
      text: "#111111",
      muted: "#6b7280",
      primary: "#111111",
      accent: "#f97316",
      danger: "#dc2626",
      border: "#e5e7eb",
      pink: "#fce7f3",
    },

    system: {
      bg: "#f8fafc",
      surface: "#f1f5f9",
      card: "#ffffff",
      text: "#0f172a",
      muted: "#64748b",
      primary: "#2563eb",
      accent: "#38bdf8",
      danger: "#dc2626",
      border: "#cbd5e1",
      pink: "#eff6ff",
    },
  };

  const colors = themes[activeTheme];

  /*
   * Set variables on :root.
   */
  root.style.setProperty("--testflow-page-bg", colors.bg);
  root.style.setProperty("--testflow-page-surface", colors.surface);
  root.style.setProperty("--testflow-page-card", colors.card);
  root.style.setProperty("--testflow-page-text", colors.text);
  root.style.setProperty("--testflow-page-muted", colors.muted);
  root.style.setProperty("--testflow-page-primary", colors.primary);
  root.style.setProperty("--testflow-page-accent", colors.accent);
  root.style.setProperty("--testflow-page-danger", colors.danger);
  root.style.setProperty("--testflow-page-border", colors.border);
  root.style.setProperty("--testflow-page-pink", colors.pink);

  /*
   * Also set them on body so all descendants inherit them.
   */
  body.style.setProperty("--testflow-page-bg", colors.bg);
  body.style.setProperty("--testflow-page-surface", colors.surface);
  body.style.setProperty("--testflow-page-card", colors.card);
  body.style.setProperty("--testflow-page-text", colors.text);
  body.style.setProperty("--testflow-page-muted", colors.muted);
  body.style.setProperty("--testflow-page-primary", colors.primary);
  body.style.setProperty("--testflow-page-accent", colors.accent);
  body.style.setProperty("--testflow-page-danger", colors.danger);
  body.style.setProperty("--testflow-page-border", colors.border);
  body.style.setProperty("--testflow-page-pink", colors.pink);

  /*
   * Persist ONLY the saved/active theme.
   */
  try {
    localStorage.setItem(THEME_STORAGE_KEY, activeTheme);
  } catch {
    // Ignore localStorage failures.
  }

  /*
   * Let other components know that the theme changed.
   */
  window.dispatchEvent(
    new CustomEvent("testflow-theme-change", {
      detail: {
        theme: activeTheme,
      },
    })
  );

  return activeTheme;
}