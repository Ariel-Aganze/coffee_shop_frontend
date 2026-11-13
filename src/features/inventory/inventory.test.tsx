/** Stock, receiving, removing and counting against a fake API. */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tokens } from '@/lib/api/tokens'
import { fixtures, json, mockApi, shellHandlers } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

type Handlers = Record<string, (r: Request) => Response | Promise<Response>>

const row = (id: number, name: string, quantity: string, minimum: string, extra = {}) => ({
  id,
  branch: 1,
  branch_name: 'Kigali Heights',
  product: id,
  product_name: name,
  product_sku: name.slice(0, 3).toUpperCase(),
  product_unit: 'each',
  product_type: 'packaged',
  product_image: null,
  product_is_active: true,
  quantity,
  minimum_threshold: minimum,
  is_low_stock: Number(quantity) <= Number(minimum),
  unit_cost: '400.0000',
  stock_value: String(Number(quantity) * 400),
  updated_at: '',
  ...extra,
})
const ROWS = [
  row(1, 'Bottled Water', '54.0000', '20.0000'),
  row(2, 'Coffee Beans', '2.5000', '5.0000', { product_unit: 'kg' }),
  row(3, 'Croissant', '0.0000', '12.0000'),
]
const SUMMARY = {
  tracked_products: 3,
  low_stock: 1,
  out_of_stock: 1,
  total_value: '22600.0000',
  costing_method: 'latest_cost',
}
const page = (results: unknown[]) =>
  json({ count: results.length, next: null, previous: null, results })

function setup(role = 'inventory_manager', extra: Handlers = {}) {
  tokens.set('a', 'r')
  return mockApi({
    ...shellHandlers(fixtures.user(role)),
    'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    'GET /api/inventory/': (req) => {
      const level = new URL(req.url).searchParams.get('level')
      return page(level === 'out' ? ROWS.filter((r) => Number(r.quantity) === 0) : ROWS)
    },
    'GET /api/inventory/summary/': () => json(SUMMARY),
    ...extra,
  })
}
const last = (calls: ReturnType<typeof mockApi>, method: string, path: string) =>
  calls.filter((c) => c.method === method && c.path === path).at(-1)!.request

beforeEach(() => {
  localStorage.clear()
  tokens.clear()
})
afterEach(() => tokens.clear())

describe('stock list', () => {
  it('shows levels with units, the summary and filters by level', async () => {
    const calls = setup()
    const { router, user } = renderApp('/inventory')
    const table = await screen.findByRole('table')
    const beans = within(table).getByText('Coffee Beans').closest('tr')!
    expect(within(beans).getByText('2.5 kg')).toBeInTheDocument()
    expect(within(beans).getByText('Low')).toBeInTheDocument()
    expect(
      within(within(table).getByText('Croissant').closest('tr')!).getByText('Out'),
    ).toBeInTheDocument()
    expect(screen.getByText('RWF 22,600')).toBeInTheDocument() // stock value tile

    await user.click(screen.getByRole('radio', { name: 'Out' }))
    await waitFor(() => expect(router.state.location.search).toBe('?level=out'))
    await waitFor(() =>
      expect(within(screen.getByRole('table')).queryByText('Coffee Beans')).toBeNull(),
    )
    expect(new URL(last(calls, 'GET', '/api/inventory/').url).searchParams.get('level')).toBe('out')
  })

  it('is read-only for an accountant', async () => {
    setup('accountant')
    renderApp('/inventory')
    const table = await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: 'Receive stock' })).not.toBeInTheDocument()
    expect(within(table).queryByRole('button', { name: /Receive|Remove/ })).toBeNull()
    expect(within(table).getByRole('link', { name: 'History of Bottled Water' })).toHaveAttribute(
      'href',
      '/inventory/movements?product=1',
    )
    expect(screen.queryByRole('link', { name: 'Stock count' })).not.toBeInTheDocument()
  })
})

describe('receiving and removing', () => {
  it('receives a delivery, checking the quantity for the unit', async () => {
    const calls = setup('inventory_manager', {
      'GET /api/products/': () =>
        page([
          {
            id: 9,
            name: 'Oat Milk',
            sku: 'OAT',
            unit: 'l',
            product_type: 'packaged',
            image: null,
          },
        ]),
      'POST /api/stock-movements/inflow/': () => json({}, 201),
    })
    const { user } = renderApp('/inventory')
    await user.click(await screen.findByRole('button', { name: 'Receive stock' }))
    const dialog = await screen.findByRole('dialog', { name: 'Receive stock' })
    await user.click(within(dialog).getByRole('button', { name: 'Receive' }))
    expect(within(dialog).getByText('Choose a product.')).toBeInTheDocument()

    await user.click(await within(dialog).findByRole('radio', { name: /Oat Milk/ }))
    await user.type(within(dialog).getByLabelText('Quantity'), '1.2345')
    await user.click(within(dialog).getByRole('button', { name: 'Receive' }))
    expect(within(dialog).getByText('Enter a quantity in litres.')).toBeInTheDocument()
    await user.clear(within(dialog).getByLabelText('Quantity'))
    await user.type(within(dialog).getByLabelText('Quantity'), '12,5')
    await user.type(within(dialog).getByLabelText('Reference (optional)'), 'INV-77')
    await user.click(within(dialog).getByRole('button', { name: 'Receive' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await last(calls, 'POST', '/api/stock-movements/inflow/').json()).toEqual({
      branch: 1,
      product_id: 9,
      quantity: '12.5',
      movement_type: 'purchase',
      reason: '',
      reference: 'INV-77',
    })
  })

  it('removes damaged stock with a reason, never more than on hand', async () => {
    const calls = setup('inventory_manager', {
      'POST /api/stock-movements/outflow/': () => json({}, 201),
    })
    const { user } = renderApp('/inventory')
    await user.click(await screen.findByRole('button', { name: 'Remove Bottled Water' }))
    const dialog = await screen.findByRole('dialog', { name: 'Take out Bottled Water' })
    expect(within(dialog).getByText('54 pcs on hand at Kigali Heights.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Quantity'), '60')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(within(dialog).getByText('Only 54 pcs on hand.')).toBeInTheDocument()
    expect(within(dialog).getByText('Give a reason.')).toBeInTheDocument()

    await user.clear(within(dialog).getByLabelText('Quantity'))
    await user.type(within(dialog).getByLabelText('Quantity'), '3')
    await user.type(within(dialog).getByLabelText('Reason'), 'Crushed in delivery')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await last(calls, 'POST', '/api/stock-movements/outflow/').json()).toMatchObject({
      branch: 1,
      product_id: 1,
      quantity: '3',
      movement_type: 'damaged',
      reason: 'Crushed in delivery',
    })
  })
})

describe('stock count', () => {
  it('sends only counted lines and shows what changed', async () => {
    const calls = setup('inventory_manager', {
      'POST /api/inventory/count/': () =>
        json(
          {
            adjusted: 1,
            lines: [
              {
                product: 1,
                product_name: 'Bottled Water',
                expected: '54.0000',
                counted: '50.0000',
                difference: '-4.0000',
              },
              {
                product: 2,
                product_name: 'Coffee Beans',
                expected: '2.5000',
                counted: '2.5000',
                difference: '0.0000',
              },
            ],
          },
          201,
        ),
    })
    const { user } = renderApp('/inventory/count')
    const water = await screen.findByLabelText('Counted Bottled Water')
    await user.type(water, '50')
    await user.type(screen.getByLabelText('Counted Coffee Beans'), '2.5')
    expect(screen.getByText('-4')).toBeInTheDocument()
    expect(screen.getByText('Matches')).toBeInTheDocument()
    expect(screen.getByText('2 of 3 counted · 1 differ')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('caffio.stockcount.1')!)).toEqual({ 1: '50', 2: '2.5' })

    await user.click(screen.getByRole('button', { name: 'Save count' }))
    expect(screen.getByText('Give a reason.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Reason'), 'Month end')
    await user.click(screen.getByRole('button', { name: 'Save count' }))
    expect(await screen.findByText('Count saved: 1 product corrected')).toBeInTheDocument()
    expect(await last(calls, 'POST', '/api/inventory/count/').json()).toEqual({
      branch: 1,
      reason: 'Month end',
      lines: [
        { product_id: 1, counted_quantity: '50' },
        { product_id: 2, counted_quantity: '2.5' },
      ],
    })
    expect(localStorage.getItem('caffio.stockcount.1')).toBeNull()
  })
})
