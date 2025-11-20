import { browser } from '$app/environment';

const API_BASE = import.meta.env.VITE_BACKEND_URL;
const COMPANY_API_KEY = import.meta.env.VITE_COMPANY_API_KEY;

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
}

class AuthService {
  async login(email: string) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return response.json();
  }

  async invite(email: string, fullName: string, role: string = 'member') {
    const response = await fetch(`${API_BASE}/auth/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${COMPANY_API_KEY}`
      },
      body: JSON.stringify({ email, fullName, role })
    });
    return response.json();
  }

  setToken(token: string) {
    if (browser) {
      localStorage.setItem('access_token', token);
    }
  }

  getToken(): string | null {
    if (!browser) return null;
    return localStorage.getItem('access_token');
  }

  clearToken() {
    if (browser) {
      localStorage.removeItem('access_token');
    }
  }

  async getProfile(): Promise<User | null> {
    const token = this.getToken();
    if (!token) return null;

    const response = await fetch(`${API_BASE}/api/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).catch(() => null);
    
    if (response && response.ok) {
      const { user } = await response.json();
      return user;
    }
    return null;
  }

  async logout() {
    this.clearToken();
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST'
    });
  }


}

export const authService = new AuthService();