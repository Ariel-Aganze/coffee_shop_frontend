/** Staff page against a fake API that filters like the real one. */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tokens } from '@/lib/api/tokens'
import { fixtures, json, mockApi, shellHandlers } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const person = (id: number, role: string, first: string, branchIds: number[], extra = {}) =>
  fixtures.user(role, {
    id,
    username: first.toLowerCase(),
    first_name: first,
    last_name: 'K',
    branch_ids: branchIds,
    ...extra,
  })

const STAFF = [
  person(11, 'cashier', 'Diane', [1], { last_login: '2026-11-12T08:30:00Z' }),
  person(12, 'branch_manager', 'Patrick', [1]),
  person(13, 'inventory_manager', 'Jean', [1, 2]),
  person(14, 'cashier', 'Gone', [1], { is_active: false }),
]

function staffList(request: Request) {
  const url = new URL(request.url)
  const q = url.searchParams
  const results = STAFF.filter(
    (u) =>
      (!q.get('role') || u.role === q.get('role')) &&
      (!q.get('is_active') || String(u.is_active) === q.get('is_active')) &&
      (!q.get('search') || u.first_name.toLowerCase().includes(q.get('search')!.toLowerCase())),
  )
  return json({ count: results.length, next: null, previous: null, results })
}

function setup(
  role: string,
  extra: Record<string, (r: Request) => Response | Promise<Response>> = {},
) {
  tokens.set('a', 'r')
  return mockApi({
    ...shellHandlers(fixtures.user(role, { id: 1 })),
    'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    'GET /api/auth/users/': staffList,
    ...extra,
  })
}

const sent = (calls: ReturnType<typeof mockApi>, method: string, path: string) =>
  calls
    .filter((c) => c.method === method && c.path === path)
    .at(-1)!
    .request.json()

beforeEach(() => {
  localStorage.clear()
  tokens.clear()
})
afterEach(() => {
  tokens.clear()
  window.innerWidth = 1024
})

describe('staff list', () => {
  it('shows active staff with roles, branches and last activity', async () => {
    setup('owner')
    renderApp('/staff')
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Diane K')).toBeInTheDocument()
    expect(within(table).getByText('Kigali Heights, Nyarutarama')).toBeInTheDocument() // Jean
    expect(within(table).getByText('2026-11-12 10:30')).toBeInTheDocument() // business timezone
    expect(within(table).getAllByText('Never signed in').length).toBeGreaterThan(0)
    expect(within(table).queryByText('Gone K')).not.toBeInTheDocument()
  })

  it('filters by role, status and search', async () => {
    const calls = setup('owner')
    const { router, user } = renderApp('/staff')
    await screen.findByRole('table')
    await user.selectOptions(screen.getByLabelText('Role'), 'cashier')
    await user.click(screen.getByRole('radio', { name: 'All' }))
    await waitFor(() =>
      expect(within(screen.getByRole('table')).getByText('Gone K')).toBeInTheDocument(),
    )
    await user.type(screen.getByRole('searchbox'), 'dia')
    await waitFor(() => expect(within(screen.getByRole('table')).queryByText('Gone K')).toBeNull())
    expect(router.state.location.search).toBe('?role=cashier&status=all&search=dia')
    const last = new URL(calls.filter((c) => c.path === '/api/auth/users/').at(-1)!.request.url)
    expect(Object.fromEntries(last.searchParams)).toMatchObject({ role: 'cashier', search: 'dia' })
    expect(last.searchParams.has('is_active')).toBe(false)
  })

  it('lets branch managers act only on cashiers and inventory managers', async () => {
    setup('branch_manager')
    renderApp('/staff')
    const table = await screen.findByRole('table')
    const patrickRow = within(table).getByText('Patrick K').closest('tr')!
    expect(within(patrickRow).getByText('Managed by the owner')).toBeInTheDocument()
    expect(within(patrickRow).queryByRole('button')).not.toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Edit Diane K' })).toBeInTheDocument()
    // Their role filter only offers the roles they manage.
    const roles = within(screen.getByLabelText('Role'))
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(roles).toEqual(['All roles', 'Cashier', 'Inventory manager'])
  })

  it('uses a card list on phones', async () => {
    window.innerWidth = 390
    setup('owner')
    renderApp('/staff')
    expect(await screen.findByText('Diane K')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('adding and editing staff', () => {
  it('requires a branch (except for accountants) and creates the account', async () => {
    const calls = setup('owner', {
      'POST /api/auth/users/': async (req) =>
        json({ ...STAFF[0], ...(await req.json()), id: 99 }, 201),
    })
    const { user } = renderApp('/staff')
    await user.click(await screen.findByRole('button', { name: 'Add staff member' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add a staff member' })
    await user.type(within(dialog).getByLabelText('First name'), 'Mutesi')
    await user.type(within(dialog).getByLabelText('Username'), 'mutesi')
    await user.type(within(dialog).getByLabelText('First password'), 'Espresso-Shot-42')
    await user.type(within(dialog).getByLabelText('Confirm password'), 'Espresso-Shot-42')
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }))
    expect(await within(dialog).findByText('Choose at least one branch.')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('checkbox', { name: 'Nyarutarama' }))
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await sent(calls, 'POST', '/api/auth/users/')).toEqual({
      first_name: 'Mutesi',
      last_name: '',
      username: 'mutesi',
      email: '',
      phone: '',
      role: 'cashier',
      branch_ids: [2],
      password: 'Espresso-Shot-42',
    })
  })

  it('shows a taken username from the server on its field', async () => {
    setup('owner', {
      'POST /api/auth/users/': () =>
        json(
          { error: 'Validation error', details: { username: ['This username is already taken.'] } },
          400,
        ),
    })
    const { user } = renderApp('/staff')
    await user.click(await screen.findByRole('button', { name: 'Add staff member' }))
    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('Role'), 'accountant') // no branch needed
    await user.type(within(dialog).getByLabelText('Username'), 'diane')
    await user.type(within(dialog).getByLabelText('First password'), 'Espresso-Shot-42')
    await user.type(within(dialog).getByLabelText('Confirm password'), 'Espresso-Shot-42')
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }))
    expect(await within(dialog).findByText('This username is already taken.')).toBeInTheDocument()
  })

  it('sends only the fields that changed when editing', async () => {
    const calls = setup('owner', {
      'PATCH /api/auth/users/11/': async (req) => json({ ...STAFF[0], ...(await req.json()) }),
    })
    const { user } = renderApp('/staff')
    await user.click(await screen.findByRole('button', { name: 'Edit Diane K' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit Diane K' })
    expect(within(dialog).queryByLabelText('Username')).not.toBeInTheDocument()
    await user.selectOptions(within(dialog).getByLabelText('Role'), 'inventory_manager')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await sent(calls, 'PATCH', '/api/auth/users/11/')).toEqual({ role: 'inventory_manager' })
  })
})

describe('account actions', () => {
  it('sets a new password after checking it locally', async () => {
    const calls = setup('owner', {
      'POST /api/auth/users/11/set-password/': () => json({ detail: 'Password updated.' }),
    })
    const { user } = renderApp('/staff')
    await user.click(await screen.findByRole('button', { name: 'Set a new password for Diane K' }))
    const dialog = await screen.findByRole('dialog', { name: 'New password for Diane K' })
    await user.type(within(dialog).getByLabelText('New password'), 'diane2026')
    await user.click(within(dialog).getByRole('button', { name: 'Set password' }))
    expect(
      within(dialog).getByText('Choose a password that meets all the requirements.'),
    ).toBeInTheDocument()

    await user.clear(within(dialog).getByLabelText('New password'))
    await user.type(within(dialog).getByLabelText('New password'), 'Fresh-Beans-77')
    await user.type(within(dialog).getByLabelText('Confirm password'), 'Fresh-Beans-77')
    await user.click(within(dialog).getByRole('button', { name: 'Set password' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await sent(calls, 'POST', '/api/auth/users/11/set-password/')).toEqual({
      new_password: 'Fresh-Beans-77',
    })
  })

  it('confirms before deactivating', async () => {
    const calls = setup('owner', {
      'DELETE /api/auth/users/11/': () => new Response(null, { status: 204 }),
    })
    const { user } = renderApp('/staff')
    await user.click(await screen.findByRole('button', { name: 'Deactivate Diane K' }))
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate Diane K?' })
    expect(within(dialog).getByText(/sales and history are kept/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true))
  })
})
