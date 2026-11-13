/** Branches page against a fake API that filters like the real one. */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tokens } from '@/lib/api/tokens'
import { fixtures, json, mockApi, shellHandlers } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const BRANCHES = [
  { ...fixtures.branches[0]!, staff_count: 4, managers: [{ id: 2, name: 'Patrick Nkurunziza' }] },
  { ...fixtures.branches[1]!, staff_count: 2 },
  { ...fixtures.branches[1]!, id: 3, name: 'Remera', is_active: false },
]

/** GET /api/branches/ honouring ?is_active and ?search. */
function branchList(request: Request) {
  const url = new URL(request.url)
  const active = url.searchParams.get('is_active')
  const search = url.searchParams.get('search')?.toLowerCase()
  const results = BRANCHES.filter(
    (b) =>
      (active === null || String(b.is_active) === active) &&
      (!search || b.name.toLowerCase().includes(search)),
  )
  return json({ count: results.length, next: null, previous: null, results })
}

function setup(
  role: string,
  extra: Record<string, (r: Request) => Response | Promise<Response>> = {},
) {
  tokens.set('a', 'r')
  return mockApi({
    ...shellHandlers(fixtures.user(role)),
    'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    'GET /api/branches/': branchList,
    ...extra,
  })
}

const listRequests = (calls: ReturnType<typeof mockApi>) =>
  calls
    .filter((c) => c.method === 'GET' && c.path === '/api/branches/')
    .map((c) => new URL(c.request.url))

beforeEach(() => {
  localStorage.clear()
  tokens.clear()
})
afterEach(() => tokens.clear())

describe('branches page', () => {
  it('lists active branches with staff and managers by default', async () => {
    const calls = setup('owner')
    renderApp('/branches')
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Kigali Heights')).toBeInTheDocument()
    expect(within(table).getByText('Patrick Nkurunziza')).toBeInTheDocument()
    expect(within(table).getByText('4 people')).toBeInTheDocument()
    expect(within(table).queryByText('Remera')).not.toBeInTheDocument()
    expect(listRequests(calls).some((u) => u.searchParams.get('is_active') === 'true')).toBe(true)
  })

  it('filters by status and search, keeping them in the URL', async () => {
    setup('owner')
    const { router, user } = renderApp('/branches')
    await screen.findByRole('table')
    await user.click(screen.getByRole('radio', { name: 'Deactivated' }))
    expect(await screen.findByText('Remera')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?status=inactive')

    await user.click(screen.getByRole('radio', { name: 'All' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search branches' }), 'nyaru')
    await waitFor(() => expect(router.state.location.search).toContain('search=nyaru'))
    await waitFor(() =>
      expect(within(screen.getByRole('table')).queryByText('Kigali Heights')).toBeNull(),
    )
    expect(within(screen.getByRole('table')).getByText('Nyarutarama')).toBeInTheDocument()
  })

  it('adds a branch and shows a duplicate name on the field', async () => {
    let attempts = 0
    const calls = setup('owner', {
      'POST /api/branches/': async (req) => {
        attempts += 1
        const body = (await req.json()) as { name: string }
        return attempts === 1
          ? json(
              {
                error: 'Validation error',
                details: { name: ['A branch with this name already exists.'] },
              },
              400,
            )
          : json({ ...BRANCHES[1], id: 9, name: body.name }, 201)
      },
    })
    const { user } = renderApp('/branches')
    await user.click(await screen.findByRole('button', { name: 'Add branch' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add a branch' })
    await user.type(within(dialog).getByLabelText('Branch name'), 'Kigali Heights')
    await user.click(within(dialog).getByRole('button', { name: 'Add branch' }))
    expect(
      await within(dialog).findByText('A branch with this name already exists.'),
    ).toBeInTheDocument()

    await user.clear(within(dialog).getByLabelText('Branch name'))
    await user.type(within(dialog).getByLabelText('Branch name'), 'Gisozi')
    await user.click(within(dialog).getByRole('button', { name: 'Add branch' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const created = calls.filter((c) => c.method === 'POST' && c.path === '/api/branches/').at(-1)!
    expect(await created.request.json()).toEqual({
      name: 'Gisozi',
      address: '',
      phone: '',
      is_active: true,
    })
  })

  it('confirms deactivation and shows why it was refused', async () => {
    setup('owner', {
      'DELETE /api/branches/1/': () =>
        json(
          {
            error: 'Validation error',
            details: ['2 cash session(s) are still open at this branch.'],
          },
          400,
        ),
    })
    const { user } = renderApp('/branches')
    await user.click(await screen.findByRole('button', { name: 'Deactivate Kigali Heights' }))
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate Kigali Heights?' })
    expect(within(dialog).getByText(/sales, stock and reports stay available/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate branch' }))
    expect(await within(dialog).findByText(/still open at this branch/)).toBeInTheDocument()
  })

  it('admins can edit but not add or deactivate; managers only view', async () => {
    setup('admin')
    const admin = renderApp('/branches')
    await screen.findByRole('table')
    expect(screen.getByRole('button', { name: 'Edit Kigali Heights' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add branch' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Deactivate/ })).not.toBeInTheDocument()
    admin.unmount()

    setup('branch_manager')
    renderApp('/branches')
    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument()
  })
})
