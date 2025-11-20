import { browser } from '$app/environment';
import { authService, type User } from '../auth';

class AuthStore {
  user = $state<User | null>(null);
  loading = $state(true);

  constructor() {
    if (browser) {
      this.init();
    } else {
      this.loading = false;
    }
  }

  async init() {
    this.user = await authService.getProfile();
    this.loading = false;
  }

  async login(email: string) {
    return authService.login(email);
  }

  async invite(email: string, fullName: string, role?: string) {
    return authService.invite(email, fullName, role);
  }

  async handleCallback(token: string) {
    authService.setToken(token);
    this.user = await authService.getProfile();
    return { success: !!this.user };
  }

  async logout(): Promise<void> {
    await authService.logout();
    this.user = null;
  }
}

export const authStore = new AuthStore();