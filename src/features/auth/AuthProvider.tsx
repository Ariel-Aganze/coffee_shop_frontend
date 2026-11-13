/**
 * Signed-in state for the whole app.
 *
 * On start-up, a stored refresh token is exchanged for an access token and the
 * user profile is loaded; meanwhile `status` is 'restoring' so screens can
 * show the loader instead of flashing the sign-in page.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { refreshAccessToken, onSessionExpired } from '@/lib/api/session'
import { tokens } from '@/lib/api/tokens'

import { fetchMe, login as loginRequest, logoutOnServer, meQueryKey, type LoginInput } from './api'
import { AuthContext, type AuthContextValue, type AuthStatus, type SignOutReason } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<AuthStatus>(() =>
    tokens.getRefresh() ? 'restoring' : 'anonymous',
  )
  const [signOutReason, setSignOutReason] = useState<SignOutReason | null>(null)

  const meQuery = useQuery({
    queryKey: meQueryKey,
    queryFn: fetchMe,
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
  })

  const endSession = useCallback(
    (reason: SignOutReason) => {
      tokens.clear()
      queryClient.clear() // never show one user's cached data to the next
      setSignOutReason(reason)
      setStatus('anonymous')
    },
    [queryClient],
  )

  // Restore a session from a stored refresh token.
  useEffect(() => {
    if (status !== 'restoring') return
    let cancelled = false
    refreshAccessToken()
      .then(() => queryClient.fetchQuery({ queryKey: meQueryKey, queryFn: fetchMe }))
      .then(() => {
        if (!cancelled) setStatus('authenticated')
      })
      .catch(() => {
        if (!cancelled) endSession('expired')
      })
    return () => {
      cancelled = true
    }
  }, [status, queryClient, endSession])

  // The API client reports when a session can no longer be renewed.
  useEffect(() => onSessionExpired(() => endSession('expired')), [endSession])

  // Signing out in one tab signs out every tab.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (
        event.key === tokens.storageKey &&
        event.newValue === null &&
        status === 'authenticated'
      ) {
        endSession('other-tab')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [status, endSession])

  const login = useCallback(
    async (input: LoginInput) => {
      const result = await loginRequest(input)
      tokens.set(result.access, result.refresh)
      queryClient.setQueryData(meQueryKey, result.user)
      setSignOutReason(null)
      setStatus('authenticated')
      return result.user
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    await logoutOnServer(tokens.getRefresh())
    endSession('manual')
  }, [endSession])

  const user = status === 'authenticated' ? (meQuery.data ?? null) : null

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signOutReason, login, logout }),
    [status, user, signOutReason, login, logout],
  )
  return <AuthContext value={value}>{children}</AuthContext>
}
