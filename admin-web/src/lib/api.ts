import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getLang, hasMessage, t } from '@/i18n'
import { API_BASE_URL } from './env'
import type { AdminProfile, ApiErrorBody, TokenPair } from './types'

const ACCESS_KEY = 'kirana.admin.accessToken'
const REFRESH_KEY = 'kirana.admin.refreshToken'
const PROFILE_KEY = 'kirana.admin.profile'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // storage unavailable (private mode); the session lasts until reload
  }
}

export const tokenStore = {
  access: () => read(ACCESS_KEY),
  refresh: () => read(REFRESH_KEY),
  profile: (): AdminProfile | null => {
    const raw = read(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as AdminProfile) : null
  },
  save(tokens: Pick<TokenPair, 'accessToken' | 'refreshToken'>, profile?: AdminProfile) {
    write(ACCESS_KEY, tokens.accessToken)
    write(REFRESH_KEY, tokens.refreshToken)
    if (profile) write(PROFILE_KEY, JSON.stringify(profile))
  },
  clear() {
    write(ACCESS_KEY, null)
    write(REFRESH_KEY, null)
    write(PROFILE_KEY, null)
  },
}

const authLostListeners = new Set<() => void>()

/** Called when the session cannot be refreshed, so the app can return to the login page. */
export function onAuthLost(listener: () => void) {
  authLostListeners.add(listener)
  return () => {
    authLostListeners.delete(listener)
  }
}

export const api = axios.create({ baseURL: `${API_BASE_URL}/api/v1` })

api.interceptors.request.use((config) => {
  const token = tokenStore.access()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing: Promise<string> | null = null

/** One refresh at a time; concurrent 401s wait for the same promise. */
function refreshAccessToken(): Promise<string> {
  if (!refreshing) {
    const refreshToken = tokenStore.refresh()
    refreshing = (refreshToken
      ? axios.post<TokenPair>(`${API_BASE_URL}/api/v1/auth/refresh`, { refreshToken }).then((res) => {
          tokenStore.save(res.data)
          return res.data.accessToken
        })
      : Promise.reject(new Error('No refresh token'))
    ).finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const isAuthCall = original?.url?.includes('/auth/')
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true
      try {
        const token = await refreshAccessToken()
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      } catch {
        tokenStore.clear()
        authLostListeners.forEach((listener) => listener())
      }
    }
    return Promise.reject(error)
  },
)

export function apiError(error: unknown): ApiErrorBody | undefined {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Partial<ApiErrorBody> | undefined
    if (data && typeof data.code === 'string') return data as ApiErrorBody
  }
  return undefined
}

/**
 * A human readable message for toasts. English shows the server's own message with field details; Hindi translates by
 * error code (field details stay as they are).
 */
export function apiErrorMessage(error: unknown, fallback?: string): string {
  const body = apiError(error)
  if (body) {
    const details = Object.entries(body.details ?? {})
      .filter(([, v]) => typeof v === 'string')
      .map(([k, v]) => `${k}: ${v as string}`)
    const english = details.length ? `${body.message} (${details.join('; ')})` : body.message
    if (getLang() === 'en') return english
    if (body.code === 'VALIDATION_ERROR') return t('error.VALIDATION_ERROR', { message: english })
    const key = `error.${body.code}`
    return hasMessage(key) ? t(key) : english
  }
  if (axios.isAxiosError(error) && !error.response) return t('error.offline')
  return fallback ?? t('error.generic')
}
