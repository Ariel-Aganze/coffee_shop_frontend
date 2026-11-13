import { createContext, use } from 'react'

import type { CurrentUser, LoginInput } from './api'

export type AuthStatus = 'restoring' | 'authenticated' | 'anonymous'

/** Why the user was signed out, so the sign-in page can explain it. */
export type SignOutReason = 'expired' | 'manual' | 'other-tab'

export interface AuthContextValue {
  status: AuthStatus
  user: CurrentUser | null
  signOutReason: SignOutReason | null
  login: (input: LoginInput) => Promise<CurrentUser>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

/** The signed-in user. Only call below a route guard that guarantees one. */
export function useCurrentUser(): CurrentUser {
  const { user } = useAuth()
  if (!user) throw new Error('useCurrentUser called without a signed-in user')
  return user
}
