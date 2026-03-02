import { create } from 'zustand';
import api from '../lib/api';

interface User {
  name: string;
  email: string;
  homeAccountId: string;
  tenantId: string;
  first_name?: string | null;
  last_name?: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/auth/session', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        set({ user: data.user, isAuthenticated: !!data.user, isLoading: false });
      } else {
        // Not authenticated
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      console.error('[AuthStore] Session check failed:', error);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { credentials: 'include' });
      set({ user: null, isAuthenticated: false });
      window.location.href = '/login';
    } catch (error) {
       console.error('[AuthStore] Logout failed:', error);
    }
  }
}));
