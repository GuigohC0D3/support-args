import axios, { AxiosError } from 'axios';
import { getSession, signOut } from 'next-auth/react';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const session = await getSession();

  const sessionError = (session as any)?.error;

  if (sessionError === 'SessionExpired' || sessionError === 'RefreshAccessTokenError') {
    await signOut({ redirect: true, callbackUrl: '/login' });
    return Promise.reject(new Error('Session expired'));
  }

  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    // Último recurso: token adulterado, revogado manualmente no servidor, etc.
    if (error.response?.status === 401) {
      await signOut({ redirect: true, callbackUrl: '/login' });
    }
    return Promise.reject(error);
  },
);

export default api;
