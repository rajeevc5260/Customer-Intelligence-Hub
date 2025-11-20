import { browser } from '$app/environment';

class ThemeStore {
  isDark = $state(false);

  constructor() {
    if (browser) {
      const saved = localStorage.getItem('theme');
      if (saved) {
        this.isDark = saved === 'dark';
      } else {
        this.isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      this.apply();
    }
  }

  toggle() {
    this.isDark = !this.isDark;
    this.apply();
  }

  private apply() {
    if (browser) {
      localStorage.setItem('theme', this.isDark ? 'dark' : 'light');
      if (this.isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }
}

export const themeStore = new ThemeStore();