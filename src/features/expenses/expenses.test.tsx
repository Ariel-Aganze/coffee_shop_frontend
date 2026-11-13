/** Expenses: list and totals, recording, correcting and reviewing against a fake API. */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { tokens } from '@/lib/api/tokens'
import { fixtures, json, mockApi, shellHandlers } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

type Handlers = Record<string, (r: Request) => Response | Promise<Response>>

const expense = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  business: 1,
  branch: 1,
  branch_name: 'Kigali Heights',
  category: 1,
  category_name: 'Supplies',
  amount: '14500.0000',
  currency_code: 'RWF',
  currency_decimal_places: 0,
  description: 'Milk & sugar',
  expense_date: '2026-11-12',
  attachment: null,
  attachment_name: null,
  status: 'pending',
  submitted_by: 50,
  submitted_by_display: 'demo_cashier',
  submitted_by_name: 'Fabrice Ndayisaba',
  reviewed_by: null,
  reviewed_by_display: null,
  reviewed_by_name: null,
  reviewed_at: null,
  review_note: '',
  created_at: '2026-11-12T07:08:00Z',
  updated_at: '',
  ...extra,
})
const CATEGORIES = [
  { id: 1, name: 'Supplies', description: '', is_active: true, expense_count: 3, created_at: '' },
  { id: 2, name: 'Old', description: '', is_active: false, expense_count: 0, created_at: '' },
]
const SUMMARY = {
  approved_total: '2153500.0000',
  approved_count: 47,
  pending_total: '14500.0000',
  pending_count: 1,
  rejected_count: 0,
}
const page = (results: unknown[]) =>
  json({ count: results.length, next: null, previous: null, results })

function setup(role: string, extra: Handlers = {}) {
  tokens.set('a', 'r')
  return mockApi({
    ...shellHandlers(fixtures.user(role)),
    'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    'GET /api/expenses/': () => page([expense(1)]),
    'GET /api/expenses/summary/': () => json(SUMMARY),
    'GET /api/expense-categories/': () => page(CATEGORIES),
    ...extra,
  })
}
const last = (calls: ReturnType<typeof mockApi>, method: string, path: string) =>
  calls.filter((c) => c.method === method && c.path === path).at(-1)!.request

beforeEach(() => {
  localStorage.clear()
  tokens.clear()
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-13T10:00:00Z') })
})
afterEach(() => {
  tokens.clear()
  vi.useRealTimers()
})

describe('expense list', () => {
  it('opens on what an approver must decide, with totals', async () => {
    const calls = setup('branch_manager')
    renderApp('/expenses')
    expect(await screen.findByRole('radio', { name: 'Pending' })).toBeChecked()
    expect(await screen.findByText('RWF 2,153,500')).toBeInTheDocument()
    expect(screen.getByText('47 expenses')).toBeInTheDocument()
    const list = new URL(last(calls, 'GET', '/api/expenses/').url).searchParams
    expect(list.get('status')).toBe('pending')
    // Totals cover every status so approved and pending sit side by side.
    expect(
      new URL(last(calls, 'GET', '/api/expenses/summary/').url).searchParams.has('status'),
    ).toBe(false)
  })

  it('shows everything to an accountant by default', async () => {
    const calls = setup('accountant')
    renderApp('/expenses')
    expect(await screen.findByRole('radio', { name: 'All' })).toBeChecked()
    await screen.findByRole('table')
    expect(new URL(last(calls, 'GET', '/api/expenses/').url).searchParams.has('status')).toBe(false)
  })
})

describe('recording an expense', () => {
  it('validates, then submits for approval', async () => {
    const calls = setup('branch_manager', {
      'POST /api/expenses/': () => json(expense(9), 201),
    })
    const { user } = renderApp('/expenses')
    await user.click(await screen.findByRole('button', { name: 'Record expense' }))
    const dialog = await screen.findByRole('dialog', { name: 'Record an expense' })
    // Deactivated categories aren't offered; a branch manager has no "Whole business".
    expect(
      within(within(dialog).getByLabelText('Category'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Choose a category', 'Supplies'])
    expect(within(dialog).queryByRole('option', { name: 'Whole business' })).toBeNull()
    expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-11-13') // shop's today

    await user.click(within(dialog).getByRole('button', { name: 'Submit for approval' }))
    expect(within(dialog).getByText('Choose a category.')).toBeInTheDocument()
    expect(within(dialog).getByText('Describe the expense.')).toBeInTheDocument()

    await user.selectOptions(within(dialog).getByLabelText('Category'), 'Supplies')
    await user.type(within(dialog).getByLabelText('Amount'), '14500')
    await user.type(within(dialog).getByLabelText('Description'), 'Milk & sugar')
    await user.click(within(dialog).getByRole('button', { name: 'Submit for approval' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await last(calls, 'POST', '/api/expenses/').json()).toEqual({
      category: 1,
      amount: '14500',
      description: 'Milk & sugar',
      branch: 1,
      expense_date: '2026-11-13',
    })
  })

  it('lets the owner file a business-wide expense', async () => {
    setup('owner')
    const { user } = renderApp('/expenses')
    await user.click(await screen.findByRole('button', { name: 'Record expense' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('option', { name: 'Whole business' })).toBeInTheDocument()
  })
})

describe('reviewing', () => {
  it('requires a reason to reject', async () => {
    const calls = setup('branch_manager', {
      'GET /api/expenses/1/': () => json(expense(1)),
      'POST /api/expenses/1/reject/': () =>
        json(expense(1, { status: 'rejected', review_note: 'No receipt' })),
    })
    const { user } = renderApp('/expenses/1')
    await user.click(await screen.findByRole('button', { name: 'Reject' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reject this expense?' })
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
    expect(within(dialog).getByText('Say why it is rejected.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Reason'), 'No receipt')
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await last(calls, 'POST', '/api/expenses/1/reject/').json()).toEqual({
      note: 'No receipt',
    })
  })

  it('never offers review of your own expense, but lets you correct it', async () => {
    setup('branch_manager', {
      'GET /api/expenses/1/': () => json(expense(1, { submitted_by: 7 })), // 7 = signed-in user
    })
    renderApp('/expenses/1')
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })

  it('shows the decision once reviewed and offers nothing to change', async () => {
    setup('owner', {
      'GET /api/expenses/1/': () =>
        json(
          expense(1, {
            status: 'approved',
            reviewed_by_name: 'Aline Uwase',
            reviewed_at: '2026-11-12T10:00:00Z',
          }),
        ),
    })
    renderApp('/expenses/1')
    expect(
      await screen.findByText('Approved by Aline Uwase on 2026-11-12 12:00.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })
})
