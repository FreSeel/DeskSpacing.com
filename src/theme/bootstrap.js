// Parser-blocking, dependency-free entry shared by both active HTML pages.
// Keep this a classic script: modules run too late to set the first-paint theme.
(() => {
  const key = 'deskspacing.theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const normalize = (value) =>
    value === 'light' || value === 'dark' ? value : 'system';
  let preference = 'system';
  try {
    preference = normalize(window.localStorage.getItem(key));
  } catch {
    // Storage may be disabled. The current document can still change themes.
  }
  function apply() {
    const theme =
      preference === 'system'
        ? system.matches
          ? 'dark'
          : 'light'
        : preference;
    const changed = root.dataset.theme !== theme;
    root.dataset.theme = theme;
    root.dataset.themePreference = preference;
    root.style.colorScheme = theme;
    document.querySelectorAll('[data-theme-select]').forEach((select) => {
      select.value = preference;
    });
    document.querySelectorAll('[data-theme-status]').forEach((status) => {
      status.textContent = `Using ${theme} theme`;
    });
    if (changed)
      window.dispatchEvent(new window.Event('deskspacing:themechange'));
  }
  apply();
  system.addEventListener('change', () => {
    if (preference === 'system') apply();
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== key && event.key !== null) return;
    try {
      if (event.storageArea !== window.localStorage) return;
    } catch {
      return;
    }
    preference = normalize(event.newValue);
    apply();
  });
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  document.addEventListener('change', (event) => {
    if (!event.target.matches('[data-theme-select]')) return;
    preference = normalize(event.target.value);
    try {
      if (preference === 'system') window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, preference);
    } catch {
      // Keep the in-memory choice even when persistence is unavailable.
    }
    apply();
  });
})();
