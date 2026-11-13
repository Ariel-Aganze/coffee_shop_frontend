import { api, unwrap } from '@/lib/api/client'
import { tokens } from '@/lib/api/tokens'
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

// ---------------------------------------------------------------- self-service
export type ProfileInput = Schema<'PatchedMeUpdateRequest'>

export function requestPasswordReset(email: string) {
  return unwrap(api.POST('/api/auth/password-reset/', { body: { email } }))
}

export function confirmPasswordReset(input: Schema<'PasswordResetConfirmRequest'>) {
  return unwrap(api.POST('/api/auth/password-reset/confirm/', { body: input }))
}

/**
 * Change the password. The server signs out every other device and returns
 * fresh tokens for this one, which are stored so this session continues.
 */
export async function changePassword(input: Schema<'ChangePasswordRequest'>) {
  const result = await unwrap(api.POST('/api/auth/change-password/', { body: input }))
  tokens.set(result.access, result.refresh)
  return result
}

export function updateProfile(input: ProfileInput) {
  return unwrap(api.PATCH('/api/auth/me/', { body: input }))
}
