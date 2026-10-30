import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, onAuthLost, tokenStore } from './api'
import type { AdminAuthResponse, AdminProfile } from './types'

interface AuthContextValue {
  admin: AdminProfile | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(() => (tokenStore.access() ? tokenStore.profile() : null))

  useEffect(() => onAuthLost(() => setAdmin(null)), [])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<AdminAuthResponse>('/admin/auth/login', { email, password })
    tokenStore.save(data, data.admin)
    setAdmin(data.admin)
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.refresh()
    tokenStore.clear()
    setAdmin(null)
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken }).catch(() => undefined)
    }
  }, [])

  const value = useMemo(() => ({ admin, login, logout }), [admin, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
