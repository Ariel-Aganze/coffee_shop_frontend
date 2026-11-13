/** Sales history, refunds and cash drawers against a fake API. */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tokens } from '@/lib/api/tokens'
import { fixtures, json, mockApi, shellHandlers } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

type Handlers = Record<string, (r: Request) => Response | Promise<Response>>

const sale = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  transaction_number: `TXN-KIGA-20261113-00000${id}`,
  branch: 1,
  branch_name: 'Kigali Heights',
  cashier: 7,
  cashier_display: 'demo_cashier',
  cashier_name: 'Diane Mukamana',
  status: 'completed',
  subtotal: '5600.0000',
  discount_total: '0.0000',
  total_amount: '5600.0000',
  currency_code: 'RWF',
  currency_decimal_places: 0,
  paid_amount: '5600.0000',
  refunded_amount: '0.0000',
  balance_due: '0.0000',
  note: '',
  created_at: '2026-11-13T08:30:00Z',
  completed_at: '2026-11-13T08:30:00Z',
  cancelled_at: null,
  cancellation_reason: '',
  items: [
    {
      id: 1,
      product: 1,
      product_name: 'Cappuccino',
      sku: 'HD-CAP',
      quantity: '2.0000',
      unit_price: '2800.0000',
      discount_amount: '0.0000',
      line_total: '5600.0000',
    },
  ],
  payments: [
    {
      id: 1,
      method: 'cash',
      method_display: 'Cash',
      amount: '5600.0000',
      currency_code: 'RWF',
      reference: '',
      is_refund: false,
      refunded_payment: null,
      received_by: 7,
      received_by_display: 'demo_cashier',
      created_at: '2026-11-13T08:30:00Z',
    },
  ],
  ...extra,
})

function setup(role: string, extra: Handlers = {}) {
  tokens.set('a', 'r')
  return mockApi({
    ...shellHandlers(fixtures.user(role)),
    'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    ...extra,
  })
}
const page = (results: unknown[]) =>
  json({ count: results.length, next: null, previous: null, results })
const last = (calls: ReturnType<typeof mockApi>, method: string, path: string) =>
  calls.filter((c) => c.method === method && c.path === path).at(-1)!.request

beforeEach(() => {
  localStorage.clear()
  tokens.clear()
})
afterEach(() => tokens.clear())

describe('sales history', () => {
  it('shows each sale’s state and filters by shop days', async () => {
    const calls = setup('owner', {
      'GET /api/sales/': () =>
        page([
          sale(1),
          sale(2, { status: 'refunded', refunded_amount: '5600.0000' }),
          sale(3, { refunded_amount: '1000.0000' }),
          sale(4, { status: 'cancelled', payments: [], paid_amount: '0.0000' }),
        ]),
    })
    const { router, user } = renderApp('/sales')
    const table = await screen.findByRole('table')
    expect(within(table).getAllByText('Paid')).toHaveLength(1)
    expect(within(table).getByText('Refunded')).toBeInTheDocument()
    expect(within(table).getByText('Partly refunded')).toBeInTheDocument()
    expect(within(table).getByText('Cancelled')).toBeInTheDocument()
    expect(within(table).getAllByText('2026-11-13 10:30')).toHaveLength(4) // Kigali time

    await user.type(screen.getByLabelText('From'), '2026-11-13')
    await user.selectOptions(screen.getByLabelText('Status'), 'refunded')
    await waitFor(() =>
      expect(router.state.location.search).toBe('?from=2026-11-13&status=refunded'),
    )
    const sent = new URL(last(calls, 'GET', '/api/sales/').url).searchParams
    expect(sent.get('from')).toBe('2026-11-13')
    expect(sent.get('status')).toBe('refunded')
  })
})

describe('refunds', () => {
  it('restocks only on a full refund and requires a reason', async () => {
    const calls = setup('branch_manager', {
      'GET /api/sales/1/': () => json(sale(1)),
      'POST /api/sales/1/refund/': () => json(sale(1, { status: 'refunded' })),
    })
    const { user } = renderApp('/sales/1')
    await user.click(await screen.findByRole('button', { name: 'Refund' }))
    const dialog = await screen.findByRole('dialog', { name: 'Refund TXN-KIGA-20261113-000001' })
    const restock = within(dialog).getByRole('checkbox', { name: /Put the items back in stock/ })
    expect(restock).toBeEnabled()

    await user.clear(within(dialog).getByLabelText('Amount to refund'))
    await user.type(within(dialog).getByLabelText('Amount to refund'), '2800')
    expect(restock).toBeDisabled() // partial

    await user.clear(within(dialog).getByLabelText('Amount to refund'))
    await user.type(within(dialog).getByLabelText('Amount to refund'), '5600')
    await user.click(restock)
    await user.click(within(dialog).getByRole('button', { name: 'Refund' }))
    expect(within(dialog).getByText('Say why, for the records.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Reason'), 'Wrong order')
    await user.click(within(dialog).getByRole('button', { name: 'Refund' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await last(calls, 'POST', '/api/sales/1/refund/').json()).toEqual({
      amount: '5600',
      reason: 'Wrong order',
      restock: true,
    })
  })

  it('is not offered to cashiers', async () => {
    setup('cashier', { 'GET /api/sales/1/': () => json(sale(1)) })
    renderApp('/sales/1')
    expect(await screen.findByText('TXN-KIGA-20261113-000001')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument()
  })
})

describe('cash drawer', () => {
  const session = {
    id: 5,
    branch: 1,
    branch_name: 'Kigali Heights',
    cashier: 7,
    cashier_display: 'demo_cashier',
    cashier_name: 'Aline Uwase',
    status: 'open',
    opening_balance: '20000.0000',
    opened_at: '2026-11-13T05:00:00Z',
    expected_cash: null,
    actual_cash: null,
    difference: null,
    discrepancy_explanation: '',
    closed_at: null,
    closed_by: null,
    currency_code: 'RWF',
    currency_decimal_places: 0,
    created_at: '',
    live_expected_cash: '25600.0000',
    movements: [],
  }
  const recon = {
    opening: '20000.0000',
    cash_sales: '5600.0000',
    cash_refunds: '0.0000',
    cash_inflows: '0.0000',
    cash_expenses: '0.0000',
    cash_withdrawals: '0.0000',
    expected_cash: '25600.0000',
  }

  it('closes with the count and asks why when it is short', async () => {
    const calls = setup('cashier', {
      'GET /api/cash-sessions/5/': () => json(session),
      'GET /api/cash-sessions/5/reconciliation/': () => json(recon),
      'POST /api/cash-sessions/5/close/': () => json({ ...session, status: 'closed' }),
    })
    const { user } = renderApp('/cash/5')
    await user.click(await screen.findByRole('button', { name: 'Close drawer' }))
    const dialog = await screen.findByRole('dialog', { name: 'Close the drawer' })
    await user.type(within(dialog).getByLabelText('Counted cash'), '25000')
    expect(within(dialog).getByText('-RWF 600')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Close drawer' }))
    expect(within(dialog).getByText('Explain the difference.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Explanation'), 'Gave too much change')
    await user.click(within(dialog).getByRole('button', { name: 'Close drawer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await last(calls, 'POST', '/api/cash-sessions/5/close/').json()).toEqual({
      actual_cash: '25000',
      explanation: 'Gave too much change',
    })
  })

  it('lets an accountant look but not touch', async () => {
    setup('accountant', {
      'GET /api/cash-sessions/5/': () => json({ ...session, cashier: 99 }),
      'GET /api/cash-sessions/5/reconciliation/': () => json(recon),
    })
    renderApp('/cash/5')
    expect(await screen.findByText('Expected in the drawer now')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close drawer' })).not.toBeInTheDocument()
  })
})

describe('payment methods setting', () => {
  it('keeps at least one method and saves the choice', async () => {
    const calls = setup('owner', {
      'GET /api/settings/currencies/': () => json([]),
      'GET /api/settings/me/currency-history/': () => json([]),
      'GET /api/cash-sessions/': () => page([]),
      'PATCH /api/settings/me/': async (req) =>
        json({ ...fixtures.settings, ...(await req.json()) }),
    })
    const { user } = renderApp('/settings')
    const card = (await screen.findByRole('heading', { name: 'Point of sale' })).closest('section')!
    for (const name of ['Cash', 'Mobile money', 'Card', 'Bank transfer']) {
      await user.click(within(card).getByRole('checkbox', { name }))
    }
    await user.click(within(card).getByRole('button', { name: 'Save changes' }))
    expect(within(card).getByText('Keep at least one payment method.')).toBeInTheDocument()
    await user.click(within(card).getByRole('checkbox', { name: 'Mobile money' }))
    await user.click(within(card).getByRole('checkbox', { name: 'Cash' }))
    await user.click(within(card).getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'PATCH' && c.path === '/api/settings/me/')).toBe(true),
    )
    expect(
      (await last(calls, 'PATCH', '/api/settings/me/').json()).enabled_payment_methods,
    ).toEqual(['cash', 'mobile_money'])
  })
})
