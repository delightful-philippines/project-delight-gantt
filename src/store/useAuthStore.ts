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
    console.log('[AuthStore] 🔍 Starting session check...');
    set({ isLoading: true });
    try {
      const response = await fetch('/api/auth/session', { credentials: 'include' });
      console.log('[AuthStore] Session response status:', response.status, response.ok);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[AuthStore] ✅ Session Data:', data);
        console.log('[AuthStore] User exists:', !!data.user);
        console.log('[AuthStore] Setting isAuthenticated to:', !!data.user);
        set({ user: data.user, isAuthenticated: !!data.user, isLoading: false });
        console.log('[AuthStore] State updated. isAuthenticated:', !!data.user);
      } else {
        console.log('[AuthStore] ❌ Response not OK, status:', response.status);
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      console.error('[AuthStore] ❌ Session check failed with error:', error);
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
