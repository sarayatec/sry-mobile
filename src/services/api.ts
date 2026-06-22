import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Production API — Apache proxies /api/ to Node on port 3001
export const BASE_URL = 'https://sry.sarayatec.com/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
