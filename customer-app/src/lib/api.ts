import axios, { AxiosError, isAxiosError, type InternalAxiosRequestConfig } from 'axios';
import { hasMessage, t, useLanguageStore } from '../i18n';
import { API_BASE_URL } from './env';
import { secureStorage } from './secureStorage';
import type { ApiErrorBody } from './types';

const ACCESS_KEY = 'kirana.accessToken';
const REFRESH_KEY = 'kirana.refreshToken';

let accessToken: string | null = null;
let refreshToken: string | null = null;

/** Tokens live in the device keystore (localStorage on web); memory copies avoid a read on every request. */
export const tokens = {
  async load() {
    [accessToken, refreshToken] = await Promise.all([
      secureStorage.get(ACCESS_KEY),
      secureStorage.get(REFRESH_KEY),
    ]);
    return accessToken != null && refreshToken != null;
  },
  async save(access: string, refresh: string) {
    accessToken = access;
    refreshToken = refresh;
    await Promise.all([secureStorage.set(ACCESS_KEY, access), secureStorage.set(REFRESH_KEY, refresh)]);
  },
  async clear() {
    accessToken = null;
    refreshToken = null;
    await Promise.all([secureStorage.remove(ACCESS_KEY), secureStorage.remove(REFRESH_KEY)]);
  },
  refresh: () => refreshToken,
};

let onSessionLost: (() => void) | null = null;

/** Called when the refresh token is rejected, so the app can return to login. */
export function setSessionLostHandler(handler: () => void) {
  onSessionLost = handler;
}

export const api = axios.create({ baseURL: `${API_BASE_URL}/api/v1`, timeout: 15_000 });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshing) {
    const current = refreshToken;
    refreshing = (
      current
        ? axios
            .post<{ accessToken: string; refreshToken: string }>(`${API_BASE_URL}/api/v1/auth/refresh`, {
              refreshToken: current,
            })
            .then(async ({ data }) => {
              await tokens.save(data.accessToken, data.refreshToken);
              return data.accessToken;
            })
        : Promise.reject(new Error('No refresh token'))
    ).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes('/auth/');
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall && refreshToken) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        await tokens.clear();
        onSessionLost?.();
      }
    }
    return Promise.reject(error);
  },
);

export function apiError(error: unknown): ApiErrorBody | undefined {
  if (isAxiosError(error)) {
    const data = error.response?.data as Partial<ApiErrorBody> | undefined;
    if (data && typeof data.code === 'string') return data as ApiErrorBody;
  }
  return undefined;
}

/**
 * Friendly message for alerts and inline errors. English shows the server's own (more specific) message; Hindi
 * translates by error code. A closed store's message is the owner's own words, so it is shown as written.
 */
export function errorMessage(error: unknown, fallback?: string): string {
  const body = apiError(error);
  if (body) return localizedMessage(body.code, body.message, body.details);
  if (isAxiosError(error) && !error.response) return t('error.offline');
  return fallback ?? t('error.generic');
}

/** Server errors and checkout violations share codes; Hindi uses the translation for the code. */
export function localizedMessage(code: string, message: string, details?: Record<string, unknown>): string {
  if (useLanguageStore.getState().lang === 'en' || code === 'STORE_CLOSED') return message;
  if (code === 'OTP_INVALID' && typeof details?.attemptsLeft === 'number') {
    return t('error.OTP_INVALID_LEFT', { count: details.attemptsLeft });
  }
  if (code === 'VALIDATION_ERROR') return t('error.VALIDATION_ERROR', { message });
  const key = `error.${code}`;
  return hasMessage(key) ? t(key) : message;
}
