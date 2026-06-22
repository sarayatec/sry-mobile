import * as SecureStore from 'expo-secure-store';
import api from './api';
import { AuthResponse, User } from '../types';

const TOKEN_KEY = 'auth_token';
const USER_KEY  = 'auth_user';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify({
    id: data.id, name: data.name, email: data.email, role: data.role,
  }));
  return data;
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function getStoredUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}
