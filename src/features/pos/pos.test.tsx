/** The point of sale end to end against a fake API. */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tokens } from '@/lib/api/tokens'
import { fixtures, json, mockApi, shellHandlers } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

type Handlers = Record<string, (r: Request) => Response | Promise<Response>>

const product = (id: number, name: string, price: string, extra = {}) => ({
  id,
  name,
  sku: name.slice(0, 3).toUpperCase(),
  description: '',
  image: null,
  category_id: 1,
  product_type: 'drink',
  price,
  stock_tracked: false,
  stock_quantity: null,
  is_low_stock: false,
  in_stock: true,
  ...extra,
})
const CATALOG = {
  branch: { id: 1, name: 'Kigali Heights' },
  currency: { code: 'RWF', symbol: 'FRw', decimal_places: 0 },
  discount: { unlimited: false, max_percent: '10.00' },
  payment_methods: [
    { code: 'cash', label: 'Cash', needs_reference: false },
    { code: 'mobile_money', label: 'Mobile Money', needs_reference: true },
  ],
  categories: [{ id: 1, name: 'Hot Drinks' }],
  products: [
    product(1, 'Cappuccino', '2800.0000'),
    product(2, 'Water', '800.0000', {
      stock_tracked: true,
      stock_quantity: '2.0000',
      is_low_stock: true,
    }),
    product(3, 'Croissant', '1500.0000', {
      stock_tracked: true,
      stock_quantity: '0.0000',
      in_stock: false,
    }),
  ],
}
const SESSION = {
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
  live_expected_cash: '20000.0000',
  movements: [],
}
const SALE = {
  id: 77,
  transaction_number: 'TXN-KIGA-20261113-000001',
  total_amount: '5600.0000',
  currency_code: 'RWF',
  currency_decimal_places: 0,
}
/**
 * Accessible-name matcher tolerant of the non-breaking space Intl puts in
 * "RWF 2,800" (getByRole's `name` compares exactly; text queries normalize).
 */
const named = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s')}$`)

const page = (results: unknown[]) =>
  json({ count: results.length, next: null, previous: null, results })

function setup({ drawer = true, role = 'cashier', extra = {} as Handlers } = {}) {
  tokens.set('a', 'r')
  return mockApi({
    ...shellHandlers(fixtures.user(role)),
    'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    'GET /api/pos/catalog/': () => json(CATALOG),
    'GET /api/cash-sessions/': () => page(drawer ? [SESSION] : []),
    'GET /api/sales/': () => page([]),
    ...extra,
  })
}
const posts = (calls: ReturnType<typeof mockApi>) =>
  calls.filter((c) => c.method === 'POST' && c.path === '/api/sales/')

beforeEach(() => {
  localStorage.clear()
  tokens.clear()
})
afterEach(() => tokens.clear())

describe('point of sale', () => {
  it('sells for cash, gives change and starts the next sale', async () => {
    const calls = setup({ extra: { 'POST /api/sales/': () => json(SALE, 201) } })
    const { user } = renderApp('/pos')
    await user.click(
      await screen.findByRole('button', { name: named('Add Cappuccino, RWF 2,800') }),
    )
    await user.click(screen.getByRole('button', { name: named('Add Cappuccino, RWF 2,800') }))
    const cart = screen.getByRole('region', { name: 'Current sale' })

    await user.click(within(cart).getByRole('button', { name: named('Charge RWF 5,600') }))
    const checkout = await screen.findByRole('dialog', { name: 'Take payment' })
    expect(within(checkout).getByRole('radio', { name: 'Cash' })).toBeChecked()
    await user.click(within(checkout).getByRole('button', { name: named('RWF 10,000') }))
    expect(within(checkout).getByText('RWF 4,400')).toBeInTheDocument() // change
    await user.click(within(checkout).getByRole('button', { name: 'Complete sale' }))

    const done = await screen.findByRole('dialog', { name: 'Sale complete' })
    expect(within(done).getByText('RWF 4,400')).toBeInTheDocument()
    const request = posts(calls)[0]!.request
    expect(request.headers.get('X-Idempotency-Key')).toMatch(/^[0-9a-f]{32}$/)
    expect(await request.json()).toEqual({
      branch: 1,
      items: [{ product_id: 1, quantity: '2', discount_amount: '0' }],
      payments: [{ method: 'cash', amount: '5600', reference: '' }], // change not recorded
    })
    await user.click(within(done).getByRole('button', { name: 'New sale' }))
    expect(within(cart).getByText('Tap a product to add it to the sale.')).toBeInTheDocument()
    expect(localStorage.getItem('caffio.pos.cart.1')).toBeNull()
  })

  it('retries a failed checkout with the same key, so it cannot sell twice', async () => {
    let attempt = 0
    const calls = setup({
      extra: {
        'POST /api/sales/': () =>
          ++attempt === 1 ? json({ error: 'Server error', details: {} }, 503) : json(SALE, 201),
      },
    })
    const { user } = renderApp('/pos')
    await user.click(
      await screen.findByRole('button', { name: named('Add Cappuccino, RWF 2,800') }),
    )
    await user.click(screen.getByRole('button', { name: named('Charge RWF 2,800') }))
    const checkout = await screen.findByRole('dialog', { name: 'Take payment' })
    await user.click(within(checkout).getByRole('button', { name: 'Complete sale' }))
    expect(await within(checkout).findByRole('alert')).toBeInTheDocument()
    await user.click(within(checkout).getByRole('button', { name: 'Complete sale' }))
    await screen.findByRole('dialog', { name: 'Sale complete' })
    const [first, second] = posts(calls).map((c) => c.request.headers.get('X-Idempotency-Key'))
    expect(first).toBeTruthy()
    expect(second).toBe(first)
  })

  it('needs an open drawer for cash, not for mobile money', async () => {
    const calls = setup({ drawer: false, extra: { 'POST /api/sales/': () => json(SALE, 201) } })
    const { user } = renderApp('/pos')
    expect(
      await screen.findByText('No cash drawer open at Kigali Heights. Open one to take cash.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: named('Add Cappuccino, RWF 2,800') }))
    await user.click(screen.getByRole('button', { name: named('Charge RWF 2,800') }))
    const checkout = await screen.findByRole('dialog', { name: 'Take payment' })
    expect(
      within(checkout).getByText('Open your cash drawer before taking cash.'),
    ).toBeInTheDocument()
    expect(within(checkout).getByRole('button', { name: 'Complete sale' })).toBeDisabled()

    await user.click(within(checkout).getByRole('radio', { name: 'Mobile money' }))
    await user.click(within(checkout).getByRole('button', { name: 'Complete sale' }))
    expect(within(checkout).getByText('Enter the reference.')).toBeInTheDocument()
    await user.type(within(checkout).getByLabelText('Reference'), 'MP-123')
    await user.click(within(checkout).getByRole('button', { name: 'Complete sale' }))
    await screen.findByRole('dialog', { name: 'Sale complete' })
    expect((await posts(calls)[0]!.request.json()).payments).toEqual([
      { method: 'mobile_money', amount: '2800', reference: 'MP-123' },
    ])
  })

  it('caps quantities at stock and keeps discounts within the cashier limit', async () => {
    setup()
    const { user } = renderApp('/pos')
    const water = await screen.findByRole('button', { name: named('Add Water, RWF 800') })
    expect(screen.getByRole('button', { name: named('Add Croissant, RWF 1,500') })).toBeDisabled()
    await user.click(water)
    await user.click(water)
    expect(water).toBeDisabled() // only 2 on hand
    expect(screen.getByRole('button', { name: 'One more Water' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Discount on Water' }))
    const dialog = await screen.findByRole('dialog', { name: 'Discount on Water' })
    expect(
      within(dialog).getByText(/Your limit is 10% of the line, at most RWF 160/),
    ).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Discount amount'), '200')
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))
    expect(within(dialog).getByText(/more than you can give here/)).toBeInTheDocument()
    await user.clear(within(dialog).getByLabelText('Discount amount'))
    await user.click(within(dialog).getByRole('button', { name: '10%' }))
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))
    const cart = screen.getByRole('region', { name: 'Current sale' })
    await waitFor(() =>
      expect(within(cart).getByText('−RWF 160', { selector: 'dd' })).toBeInTheDocument(),
    )
    expect(within(cart).getByRole('button', { name: named('Charge RWF 1,440') })).toBeEnabled()
  })

  it('keeps the cart across a reload', async () => {
    localStorage.setItem(
      'caffio.pos.cart.1',
      JSON.stringify([{ productId: 1, quantity: 3, discount: '0' }]),
    )
    setup()
    renderApp('/pos')
    expect(
      await screen.findByRole('button', { name: named('Charge RWF 8,400') }),
    ).toBeInTheDocument()
  })

  it('asks an owner on "All branches" where they are selling', async () => {
    setup({ role: 'owner' })
    const { user } = renderApp('/pos')
    expect(await screen.findByText('Which branch are you selling at?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kigali Heights' }))
    expect(
      await screen.findByRole('button', { name: named('Add Cappuccino, RWF 2,800') }),
    ).toBeInTheDocument()
  })
})
