/**
 * Forgot / reset password, change password and profile — through the real app,
 * against a fake API that answers with the backend's error envelope.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tokens } from '@/lib/api/tokens'
import { fixtures, json, mockApi, shellHandlers } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const validationError = (details: Record<string, string[]>) =>
  json({ error: 'Validation error', details }, 400)

const signedIn = (role = 'cashier', overrides: Record<string, unknown> = {}) => {
  tokens.set('a', 'r')
  const user = fixtures.user(role, overrides)
  return {
    user,
    handlers: {
      ...shellHandlers(user),
      'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  tokens.clear()
})
afterEach(() => tokens.clear())

// ------------------------------------------------------------------ forgot
describe('forgot password', () => {
  it('validates the email, sends the request and confirms without revealing accounts', async () => {
    const calls = mockApi({
      'POST /api/auth/password-reset/': () => json({ detail: 'If the email exists…' }),
    })
    const { user } = renderApp('/forgot-password')
    const email = await screen.findByLabelText('Email address')
    await user.type(email, 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()

    await user.clear(email)
    await user.type(email, 'diane@demo.example')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    const heading = await screen.findByRole('heading', { name: 'Check your email' })
    expect(heading).toHaveFocus() // announced to screen readers
    expect(screen.getByText(/If an account uses diane@demo.example/)).toBeInTheDocument()
    expect(await calls[0]?.request.json()).toEqual({ email: 'diane@demo.example' })

    await user.click(screen.getByRole('button', { name: 'Use a different email' }))
    expect(screen.getByLabelText('Email address')).toHaveValue('')
  })
})

// ------------------------------------------------------------------ reset
describe('reset password', () => {
  const link = '/reset-password?uid=Nw&token=abc-123'

  it('explains a broken link (no parameters)', async () => {
    mockApi({})
    renderApp('/reset-password')
    expect(
      await screen.findByRole('heading', { name: "This link doesn't work" }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('shows the requirements live and checks the confirmation', async () => {
    mockApi({})
    const { user } = renderApp(link)
    const password = await screen.findByLabelText('New password')
    await user.type(password, '1234')
    const rules = screen.getByRole('list', { name: 'Password requirements' })
    expect(within(rules).getByText(/At least 8 characters/)).toHaveTextContent('(not yet)')
    expect(within(rules).getByText(/Not only numbers/)).toHaveTextContent('(not yet)')

    await user.clear(password)
    await user.type(password, 'Espresso-Shot-42')
    expect(within(rules).getByText(/At least 8 characters/)).toHaveTextContent('(done)')
    await user.type(screen.getByLabelText('Confirm new password'), 'Espresso-Shot-41')
    await user.click(screen.getByRole('button', { name: 'Set new password' }))
    expect(screen.getByText("The two passwords don't match.")).toBeInTheDocument()
  })

  it('shows the server’s password rules on the field', async () => {
    mockApi({
      'POST /api/auth/password-reset/confirm/': () =>
        validationError({ new_password: ['This password is too common.'] }),
    })
    const { user } = renderApp(link)
    await user.type(await screen.findByLabelText('New password'), 'Password123')
    await user.type(screen.getByLabelText('Confirm new password'), 'Password123')
    await user.click(screen.getByRole('button', { name: 'Set new password' }))
    expect(await screen.findByText('This password is too common.')).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true')
  })

  it('switches to the broken-link screen when the token is rejected', async () => {
    mockApi({
      'POST /api/auth/password-reset/confirm/': () =>
        validationError({ token: ['This reset link is invalid or has expired.'] }),
    })
    const { user } = renderApp(link)
    await user.type(await screen.findByLabelText('New password'), 'Espresso-Shot-42')
    await user.type(screen.getByLabelText('Confirm new password'), 'Espresso-Shot-42')
    await user.click(screen.getByRole('button', { name: 'Set new password' }))
    expect(await screen.findByRole('heading', { name: "This link doesn't work" })).toHaveFocus()
  })

  it('confirms success and signs this browser out (every device was)', async () => {
    const { handlers } = signedIn()
    const calls = mockApi({
      ...handlers,
      'POST /api/auth/password-reset/confirm/': () => json({ detail: 'Password has been reset.' }),
      'POST /api/auth/logout/': () => new Response(null, { status: 204 }),
    })
    const { user } = renderApp(link)
    await user.type(await screen.findByLabelText('New password'), 'Espresso-Shot-42')
    await user.type(screen.getByLabelText('Confirm new password'), 'Espresso-Shot-42')
    await user.click(screen.getByRole('button', { name: 'Set new password' }))
    expect(await screen.findByRole('heading', { name: 'Password updated' })).toHaveFocus()
    const confirm = calls.find((c) => c.path === '/api/auth/password-reset/confirm/')
    expect(await confirm?.request.json()).toEqual({
      uid: 'Nw',
      token: 'abc-123',
      new_password: 'Espresso-Shot-42',
    })
    await waitFor(() => expect(tokens.getRefresh()).toBeNull())
  })
})

// ------------------------------------------------------------------ change password
/** Fill and submit the change-password form. */
async function fill(user: ReturnType<typeof renderApp>['user'], current: string, next: string) {
  await user.type(await screen.findByLabelText('Current password'), current)
  await user.type(screen.getByLabelText('New password'), next)
  await user.type(screen.getByLabelText('Confirm new password'), next)
  await user.click(screen.getByRole('button', { name: 'Update password' }))
}

describe('change password', () => {
  it('flags a wrong current password on its field', async () => {
    const { handlers } = signedIn()
    mockApi({
      ...handlers,
      'POST /api/auth/change-password/': () =>
        validationError({ old_password: ['Current password is incorrect.'] }),
    })
    const { user } = renderApp('/profile/password')
    await fill(user, 'wrong-one', 'Espresso-Shot-42')
    expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument()
    expect(screen.getByLabelText('Current password')).toHaveFocus()
  })

  it('refuses a password resembling the user before calling the API', async () => {
    const { handlers } = signedIn()
    const calls = mockApi(handlers)
    const { user } = renderApp('/profile/password')
    await fill(user, 'Old-Password-1', 'aline-uwase-2026')
    expect(
      screen.getByText('Choose a password that meets all the requirements.'),
    ).toBeInTheDocument()
    expect(calls.some((c) => c.path === '/api/auth/change-password/')).toBe(false)
  })

  it('keeps this device signed in with the new tokens and returns to the profile', async () => {
    const { handlers } = signedIn()
    const calls = mockApi({
      ...handlers,
      'POST /api/auth/change-password/': () =>
        json({ detail: 'Password updated.', access: 'new-access', refresh: 'new-refresh' }),
    })
    const { router, user } = renderApp('/profile/password')
    await fill(user, 'Old-Password-1', 'Espresso-Shot-42')
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'))
    expect(tokens.getRefresh()).toBe('new-refresh')
    expect(tokens.getAccess()).toBe('new-access')
    const request = calls.find((c) => c.path === '/api/auth/change-password/')
    expect(await request?.request.json()).toEqual({
      old_password: 'Old-Password-1',
      new_password: 'Espresso-Shot-42',
    })
  })
})

// ------------------------------------------------------------------ profile
describe('profile', () => {
  it('shows the account summary', async () => {
    const { handlers } = signedIn('cashier')
    mockApi(handlers)
    renderApp('/profile')
    expect(await screen.findByText('demo_cashier')).toBeInTheDocument()
    expect(screen.getAllByText('Cashier').length).toBeGreaterThan(0)
    const branchesRow = screen.getByText('Branches').parentElement!
    expect(branchesRow).toHaveTextContent('Kigali Heights') // assigned branch
    expect(screen.getByText('2026-10-01')).toBeInTheDocument() // business date format
  })

  it('saves only changed fields and updates the name everywhere', async () => {
    const { handlers, user: me } = signedIn('cashier')
    const calls = mockApi({
      ...handlers,
      'PATCH /api/auth/me/': async (req) => json({ ...me, ...(await req.json()) }),
    })
    const { user } = renderApp('/profile')
    const save = await screen.findByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled() // nothing changed yet

    const first = screen.getByLabelText('First name')
    await user.clear(first)
    await user.type(first, 'Dina')
    await user.click(save)

    await waitFor(() => expect(screen.getAllByText('Dina Uwase').length).toBeGreaterThan(0))
    const patch = calls.find((c) => c.path === '/api/auth/me/' && c.method === 'PATCH')
    expect(await patch?.request.json()).toEqual({ first_name: 'Dina' })
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('shows a duplicate email on the email field', async () => {
    const { handlers } = signedIn('cashier')
    mockApi({
      ...handlers,
      'PATCH /api/auth/me/': () =>
        validationError({ email: ['This email is already used by another account.'] }),
    })
    const { user } = renderApp('/profile')
    const email = await screen.findByLabelText('Email')
    await user.clear(email)
    await user.type(email, 'taken@demo.example')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(
      await screen.findByText('This email is already used by another account.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })
})
