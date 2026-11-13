import type { UseFormSetError } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from './api/errors'
import { applyServerErrors } from './forms'

type Form = { currentPassword: string; newPassword: string; email: string }

const envelope = (details: Record<string, string[]>) =>
  new ApiError(400, { error: 'Validation error', details })

describe('applyServerErrors', () => {
  it('puts API field messages on the mapped form fields', () => {
    const setError = vi.fn<UseFormSetError<Form>>()
    const banner = applyServerErrors<Form>(
      envelope({ old_password: ['Current password is incorrect.'] }),
      setError,
      { old_password: 'currentPassword' },
    )
    expect(setError).toHaveBeenCalledWith(
      'currentPassword',
      { type: 'server', message: 'Current password is incorrect.' },
      { shouldFocus: true },
    )
    expect(banner).toBeNull() // everything is shown on a field
  })

  it('maps same-named fields automatically and joins multiple messages', () => {
    const setError = vi.fn<UseFormSetError<Form>>()
    applyServerErrors<Form>(
      envelope({ email: ['Enter a valid email.', 'Already used.'] }),
      setError,
      {},
      ['email'],
    )
    expect(setError).toHaveBeenCalledWith(
      'email',
      { type: 'server', message: 'Enter a valid email. Already used.' },
      { shouldFocus: true },
    )
  })

  it('returns a banner message for problems no field can show', () => {
    const setError = vi.fn<UseFormSetError<Form>>()
    const banner = applyServerErrors<Form>(
      envelope({ token: ['This reset link is invalid or has expired.'] }),
      setError,
    )
    expect(setError).not.toHaveBeenCalled()
    expect(banner).toBe('This reset link is invalid or has expired.')
  })

  it('handles non-API errors', () => {
    expect(applyServerErrors<Form>(new Error('Offline'), vi.fn<UseFormSetError<Form>>())).toBe(
      'Offline',
    )
  })
})
