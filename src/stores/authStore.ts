import { create } from 'zustand';
import { User } from '../types';
import { login as apiLogin, logout as apiLogout, getStoredUser } from '../services/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  init: async () => {
    try {
      const user = await getStoredUser();
      set({ user, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  login: async (email, password) => {
    set({ error: null });
    const data = await apiLogin(email, password);
    set({
      user: { id: data.id, name: data.name, email: data.email, role: data.role },
    });
  },

  logout: async () => {
    await apiLogout();
    set({ user: null });
  },

  clearError: () => set({ error: null }),
}));
