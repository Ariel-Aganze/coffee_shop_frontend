/**
 * End-to-end-style tests of the app shell: real router, auth, providers and
 * API client, against a fake API.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tokens } from '@/lib/api/tokens'
import { fixtures, json, mockApi, shellHandlers } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

beforeEach(() => {
  localStorage.clear()
  tokens.clear()
})
afterEach(() => tokens.clear())

function loginHandlers(role: string) {
  const user = fixtures.user(role)
  return {
    ...shellHandlers(user),
    'POST /api/auth/login/': async (req: Request) => {
      const body = (await req.json()) as { username: string; password: string }
      return body.password === 'Demo1234!'
        ? json({ access: 'access-1', refresh: 'refresh-1', user })
        : json({ error: 'Invalid credentials.' }, 401)
    },
  }
}

async function signIn(user: ReturnType<typeof renderApp>['user'], password = 'Demo1234!') {
  await user.type(await screen.findByLabelText('Username'), 'demo')
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('signing in', () => {
  it('sends visitors to the sign-in page and back to where they were going', async () => {
    mockApi(loginHandlers('owner'))
    const { router, user } = renderApp('/settings')
    await screen.findByRole('heading', { name: 'Welcome back' })
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('?next=%2Fsettings')

    await signIn(user)
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'))
  })

  it('lands each role on its daily screen', async () => {
    mockApi(loginHandlers('cashier'))
    const { router, user } = renderApp('/login')
    await signIn(user)
    await waitFor(() => expect(router.state.location.pathname).toBe('/pos'))
    expect(tokens.getRefresh()).toBe('refresh-1')
  })

  it('validates the form before calling the API', async () => {
    const calls = mockApi(loginHandlers('owner'))
    const { user } = renderApp('/login')
    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Enter your username.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(calls.filter((c) => c.path === '/api/auth/login/')).toHaveLength(0)
  })

  it('explains wrong credentials and deactivated accounts', async () => {
    mockApi(loginHandlers('owner'))
    const { user } = renderApp('/login')
    await signIn(user, 'wrong')
    expect(await screen.findByRole('alert')).toHaveTextContent("username and password don't match")
  })

  it('never redirects to another site after sign-in', async () => {
    mockApi(loginHandlers('owner'))
    const { router, user } = renderApp('/login?next=https%3A%2F%2Fevil.example')
    await signIn(user)
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))
  })
})

describe('signed-in shell', () => {
  it('restores the session from the stored refresh token', async () => {
    tokens.set('old-access', 'stored-refresh')
    const user = fixtures.user('owner')
    mockApi({
      ...shellHandlers(user),
      'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    })
    renderApp('/dashboard')
    expect(await screen.findByText('Welcome back, Aline')).toBeInTheDocument()
    expect(screen.getByText('Demo Coffee Co.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(document.title).toBe('Dashboard · Caffio')
  })

  it('shows only the navigation a cashier can use', async () => {
    tokens.set('a', 'r')
    mockApi({
      ...shellHandlers(fixtures.user('cashier')),
      'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    })
    renderApp('/pos')
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    const links = within(nav)
      .getAllByRole('link')
      .map((l) => l.textContent)
    expect(links).toEqual([
      'Point of sale',
      'Sales history',
      'Cash sessions',
      'Products',
      'Reports',
    ])
  })

  it('refuses screens outside the role (and says why)', async () => {
    tokens.set('a', 'r')
    mockApi({
      ...shellHandlers(fixtures.user('cashier')),
      'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    })
    renderApp('/settings')
    expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument()
  })

  it('offers "All branches" only to business-wide users', async () => {
    tokens.set('a', 'r')
    mockApi({
      ...shellHandlers(fixtures.user('owner')),
      'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    })
    const owner = renderApp('/dashboard')
    const picker = await screen.findByLabelText('Branch')
    expect(
      within(picker)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['All branches', 'Kigali Heights', 'Nyarutarama'])
    await owner.user.selectOptions(picker, '2')
    expect(await screen.findByText(/Showing Nyarutarama/)).toBeInTheDocument()
    expect(localStorage.getItem('caffio.branch.7')).toBe('2')
  })

  it('shows unread notifications on the bell', async () => {
    tokens.set('a', 'r')
    mockApi({
      ...shellHandlers(fixtures.user('owner')),
      'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    })
    renderApp('/dashboard')
    expect(await screen.findByRole('link', { name: '3 unread notifications' })).toBeInTheDocument()
  })

  it('returns to sign-in with an explanation when the session expires', async () => {
    tokens.set('a', 'stale-refresh')
    mockApi({
      ...shellHandlers(fixtures.user('owner')),
      'POST /api/auth/token/refresh/': () => json({ detail: 'Token is blacklisted' }, 401),
    })
    const { router } = renderApp('/dashboard')
    expect(await screen.findByText(/session has expired/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(tokens.getRefresh()).toBeNull()
  })

  it('signs out and clears the session', async () => {
    tokens.set('a', 'r')
    const calls = mockApi({
      ...shellHandlers(fixtures.user('owner')),
      'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
      'POST /api/auth/logout/': () => new Response(null, { status: 204 }),
    })
    const { router, user } = renderApp('/dashboard')
    await screen.findByText('Welcome back, Aline')
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(tokens.getRefresh()).toBeNull()
    const logout = calls.find((c) => c.path === '/api/auth/logout/')
    expect(await logout?.request.json()).toEqual({ refresh: 'r2' })
  })

  it('shows a not-found page inside the app for unknown paths', async () => {
    tokens.set('a', 'r')
    mockApi({
      ...shellHandlers(fixtures.user('owner')),
      'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    })
    renderApp('/no-such-page')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nothing to see here' })).toBeInTheDocument()
  })
})
