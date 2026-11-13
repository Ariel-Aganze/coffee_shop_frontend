/** Dashboard: periods, scope and the distinct financial figures against a fake API. */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { tokens } from '@/lib/api/tokens'
import { fixtures, json, mockApi, shellHandlers } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const windowOf = (from: string, to: string, net: string, n: number) => ({
  from,
  to,
  gross_sales: net,
  refunds: '0',
  net_sales: net,
  transactions: n,
  average_transaction_value: '0',
})
const branchRow = (id: number, name: string, net: string) => ({
  branch_id: id,
  branch_name: name,
  net_sales: net,
  transactions: 10,
  average_transaction_value: '3000',
  expenses: '1000',
})
const DASHBOARD = {
  currency: { code: 'RWF', symbol: 'FRw', decimal_places: 0 },
  other_currencies_in_period: [],
  period: { from: '2026-11-01', to: '2026-11-13' },
  scope: { branch_ids: null, timezone: 'Africa/Kigali' },
  sales: {
    today: windowOf('2026-11-13', '2026-11-13', '12000.0000', 4),
    this_week: windowOf('2026-11-09', '2026-11-13', '90000.0000', 30),
    this_month: windowOf('2026-11-01', '2026-11-13', '250000.0000', 80),
  },
  overview: {
    gross_sales: '255000.0000',
    refunds: '5000.0000',
    net_sales: '250000.0000',
    transactions: 80,
    average_transaction_value: '3125.0000',
    revenue: '250000.0000',
    cost_of_goods_sold: '100000.0000',
    gross_profit: '150000.0000',
    expenses: '170000.0000',
    operating_result: '-20000.0000',
    notes: [],
  },
  branch_performance: {
    branches: [branchRow(1, 'Kigali Heights', '200000'), branchRow(2, 'Nyarutarama', '50000')],
    best_branch: branchRow(1, 'Kigali Heights', '200000'),
    lowest_branch: branchRow(2, 'Nyarutarama', '50000'),
  },
  sales_trend: {
    truncated: false,
    days: [{ date: '2026-11-12', net_sales: '12000', transactions: 4 }],
  },
  products: { best_selling: [], lowest_selling: [] },
  inventory: {
    low_stock_count: 0,
    low_stock: [],
    stock_valuation: '0',
    stock_valuation_method: '',
    items_without_cost_price: 0,
    recent_movements: [],
  },
  operations: {
    active_cash_sessions: [],
    recent_transactions: [],
    pending_approvals: { expenses: [] },
    unread_notifications: 0,
    recent_activity: [],
  },
}

function setup(role = 'owner') {
  tokens.set('a', 'r')
  return mockApi({
    ...shellHandlers(fixtures.user(role)),
    'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    'GET /api/reports/dashboard/': () => json(DASHBOARD),
  })
}
const lastQuery = (calls: ReturnType<typeof mockApi>) =>
  Object.fromEntries(
    new URL(calls.filter((c) => c.path === '/api/reports/dashboard/').at(-1)!.request.url)
      .searchParams,
  )

beforeEach(() => {
  localStorage.clear()
  tokens.clear()
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-13T10:00:00Z') }) // a Friday
})
afterEach(() => {
  tokens.clear()
  vi.useRealTimers()
})

describe('dashboard', () => {
  it('keeps revenue, gross profit and the operating result apart', async () => {
    const calls = setup()
    renderApp('/dashboard')
    const results = (
      await screen.findByRole('heading', { name: 'Results for the period' })
    ).closest('section')!
    const value = (label: string) =>
      within(results).getByText(label).nextElementSibling?.textContent
    expect(value('Revenue')).toMatch(/RWF\s250,000/)
    expect(value('Gross profit')).toMatch(/RWF\s150,000/)
    expect(value('Operating result')).toMatch(/-RWF\s20,000/)
    expect(within(results).getByText('60% margin')).toBeInTheDocument()
    expect(lastQuery(calls)).toEqual({ from: '2026-11-01', to: '2026-11-13' }) // this month
  })

  it('changes the period from presets and custom dates', async () => {
    const calls = setup()
    const { router, user } = renderApp('/dashboard')
    await user.click(await screen.findByRole('radio', { name: 'This week' }))
    await waitFor(() => expect(lastQuery(calls)).toEqual({ from: '2026-11-09', to: '2026-11-13' }))
    expect(router.state.location.search).toBe('?from=2026-11-09&to=2026-11-13')

    await user.click(screen.getByRole('radio', { name: 'Custom' }))
    expect(screen.getByLabelText('To')).toHaveAttribute('max', '2026-11-13')
  })

  it('compares branches across the business, but not inside one branch', async () => {
    setup()
    renderApp('/dashboard')
    const card = (await screen.findByRole('heading', { name: 'Branches compared' })).closest(
      'section',
    )!
    expect(within(card).getByText('Best')).toBeInTheDocument()
    expect(within(card).getByText('Lowest')).toBeInTheDocument()
  })

  it('shows a branch manager their own branch only', async () => {
    const calls = setup('branch_manager')
    renderApp('/dashboard')
    expect(await screen.findByText(/Showing Kigali Heights/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Branches compared' })).not.toBeInTheDocument()
    expect(lastQuery(calls).branch).toBe('1')
  })
})
