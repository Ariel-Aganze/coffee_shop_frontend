import { api, unwrap } from '@/lib/api/client'
import type { Schema } from '@/lib/api/types'

export type CurrentUser = Schema<'User'>
export type LoginInput = Schema<'LoginCredentialsRequest'>

export const meQueryKey = ['auth', 'me'] as const

export function fetchMe(): Promise<CurrentUser> {
  return unwrap(api.GET('/api/auth/me/'))
}

export function login(input: LoginInput) {
  return unwrap(api.POST('/api/auth/login/', { body: input }))
}

/** Blacklists the refresh token on the server. Best effort: never blocks sign-out. */
export async function logoutOnServer(refresh: string | null): Promise<void> {
  if (!refresh) return
  try {
    await unwrap(api.POST('/api/auth/logout/', { body: { refresh } }))
  } catch {
    // Already invalid or offline: the token is cleared locally regardless.
  }
}
