export type AdminTheme = 'light' | 'dark';

const ADMIN_THEME_KEY = 'fest_admin_theme';

export function readAdminTheme(): AdminTheme {
  try {
    return localStorage.getItem(ADMIN_THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyAdminTheme(theme: AdminTheme) {
  if (typeof document === 'undefined') return;
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  try {
    localStorage.setItem(ADMIN_THEME_KEY, theme);
  } catch {
    // Ignore
  }
}

export function clearDocumentDarkClass() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('dark');
}
