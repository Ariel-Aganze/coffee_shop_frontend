/** Notifications and the audit log against a fake API. */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tokens } from '@/lib/api/tokens'
import { fixtures, json, mockApi, shellHandlers } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

type Handlers = Record<string, (r: Request) => Response | Promise<Response>>

const note = (id: number, type: string, metadata: Record<string, unknown>, extra = {}) => ({
  id,
  notification_type: type,
  title: `Title ${id}`,
  message: `Message ${id}`,
  metadata,
  branch: 1,
  branch_name: 'Kigali Heights',
  is_read: false,
  read_at: null,
  created_at: '2026-11-13T08:00:00Z',
  ...extra,
})
const page = (results: unknown[]) =>
  json({ count: results.length, next: null, previous: null, results })

function setup(role: string, extra: Handlers) {
  tokens.set('a', 'r')
  return mockApi({
    ...shellHandlers(fixtures.user(role)),
    'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    ...extra,
  })
}

beforeEach(() => {
  localStorage.clear()
  tokens.clear()
})
afterEach(() => tokens.clear())

describe('notifications', () => {
  it('lists unread ones and opens what they are about', async () => {
    const calls = setup('owner', {
      'GET /api/notifications/': () =>
        page([
          note(1, 'pending_approval', { expense_id: 50 }),
          note(2, 'low_stock', { sku: 'CD-WAT' }),
        ]),
      'POST /api/notifications/1/mark-read/': () =>
        json(note(1, 'pending_approval', {}, { is_read: true })),
      'GET /api/expenses/50/': () => json({ error: 'Not found.', details: {} }, 404),
    })
    const { router, user } = renderApp('/notifications')
    await user.click(await screen.findByRole('button', { name: /Title 1/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/expenses/50'))
    expect(
      calls.some((c) => c.method === 'POST' && c.path === '/api/notifications/1/mark-read/'),
    ).toBe(true)
    const list = new URL(calls.find((c) => c.path === '/api/notifications/')!.request.url)
    expect(list.searchParams.get('unread')).toBe('true')
  })

  it('marks everything read', async () => {
    const calls = setup('owner', {
      'GET /api/notifications/': () => page([note(1, 'low_stock', {})]),
      'POST /api/notifications/mark-all-read/': () => json({ updated: 1 }),
    })
    const { user } = renderApp('/notifications')
    await screen.findByRole('button', { name: /Title 1/ })
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }))
    await waitFor(() =>
      expect(calls.some((c) => c.path === '/api/notifications/mark-all-read/')).toBe(true),
    )
  })

  it('says when there is nothing new', async () => {
    setup('cashier', { 'GET /api/notifications/': () => page([]) })
    renderApp('/notifications')
    expect(await screen.findByText('You’re all caught up')).toBeInTheDocument()
  })
})

describe('audit log', () => {
  const entry = {
    id: 9,
    created_at: '2026-11-13T08:00:00Z',
    action: 'sale_refunded',
    user: { id: 2, username: 'demo_manager1', name: 'Patrick N', role: 'branch_manager' },
    branch: { id: 1, name: 'Kigali Heights' },
    target_type: 'Sale',
    target_id: '2473',
    metadata: { refund_amount: '1500.0000', reason: 'Wrong order' },
    previous_value: null,
    new_value: null,
  }

  it('shows readable actions, links records and filters by action', async () => {
    const calls = setup('owner', {
      'GET /api/audit/': () =>
        page([entry, { ...entry, id: 10, action: 'mystery_thing', target_type: '' }]),
      'GET /api/audit/actions/': () => json(['sale_refunded', 'mystery_thing']),
    })
    const { router, user } = renderApp('/audit')
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Refunded a sale')).toBeInTheDocument()
    expect(within(table).getByText('Mystery thing')).toBeInTheDocument() // untranslated → humanized
    expect(within(table).getByRole('link', { name: 'Sale #2473' })).toHaveAttribute(
      'href',
      '/sales/2473',
    )

    await user.click(within(table).getAllByRole('button', { name: 'Details' })[0]!)
    const dialog = await screen.findByRole('dialog', { name: 'Refunded a sale' })
    expect(within(dialog).getByText('Wrong order')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /close/i }))

    await user.selectOptions(screen.getByLabelText('Action'), 'sale_refunded')
    await waitFor(() => expect(router.state.location.search).toBe('?action=sale_refunded'))
    const last = new URL(calls.filter((c) => c.path === '/api/audit/').at(-1)!.request.url)
    expect(last.searchParams.get('action')).toBe('sale_refunded')
  })
})
