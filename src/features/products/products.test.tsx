/** Products, product detail (prices, availability) and categories against a fake API. */
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { tokens } from '@/lib/api/tokens'
import { fixtures, json, mockApi, shellHandlers } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

import type * as productApi from './api'
import { createProduct, withImage } from './api'

// Real API calls, except where a test overrides createProduct once.
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof productApi>()
  return {
    ...actual,
    createProduct: vi.fn<typeof actual.createProduct>(actual.createProduct),
  }
})

type Handlers = Record<string, (r: Request) => Response | Promise<Response>>

const product = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  sku: name.slice(0, 3).toUpperCase(),
  description: '',
  image: null,
  category: 1,
  category_name: 'Hot Drinks',
  product_type: 'drink',
  is_active: true,
  current_price: '2800.0000',
  current_cost_price: '850.0000',
  hidden_branch_ids: [],
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...extra,
})

const PRODUCTS = [
  product(7, 'Cappuccino'),
  product(8, 'Croissant', {
    product_type: 'food',
    category: 2,
    category_name: 'Bakery',
    current_price: '1800.0000',
    current_cost_price: '700.0000',
    hidden_branch_ids: [2],
  }),
]
const CATEGORIES = [
  {
    id: 1,
    name: 'Hot Drinks',
    description: '',
    is_active: true,
    product_count: 1,
    created_at: '',
    updated_at: '',
  },
  {
    id: 2,
    name: 'Bakery',
    description: '',
    is_active: true,
    product_count: 3,
    created_at: '',
    updated_at: '',
  },
  {
    id: 3,
    name: 'Seasonal',
    description: '',
    is_active: false,
    product_count: 0,
    created_at: '',
    updated_at: '',
  },
]
const page = (results: unknown[]) =>
  json({ count: results.length, next: null, previous: null, results })

function setup(role: string, extra: Handlers = {}) {
  tokens.set('a', 'r')
  return mockApi({
    ...shellHandlers(fixtures.user(role)),
    'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    'GET /api/products/': () => page(PRODUCTS),
    'GET /api/categories/': (req) => {
      const active = new URL(req.url).searchParams.get('is_active')
      return page(CATEGORIES.filter((c) => active === null || String(c.is_active) === active))
    },
    ...extra,
  })
}
const lastRequest = (calls: ReturnType<typeof mockApi>, method: string, path: string) =>
  calls.filter((c) => c.method === method && c.path === path).at(-1)?.request

beforeEach(() => {
  localStorage.clear()
  tokens.clear()
})
afterEach(() => {
  tokens.clear()
})

describe('product list', () => {
  it('shows prices, margins and where a product is not sold', async () => {
    setup('owner')
    renderApp('/products')
    const table = await screen.findByRole('table')
    const row = within(table).getByRole('link', { name: 'Croissant' }).closest('tr')!
    expect(within(row).getByText('RWF 1,800')).toBeInTheDocument()
    expect(within(row).getByText('61%')).toBeInTheDocument()
    expect(within(row).getByText('Not sold at Nyarutarama')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Edit Croissant' })).toBeInTheDocument()
  })

  it('keeps filters in the URL and sends them to the API', async () => {
    const calls = setup('owner')
    const { router, user } = renderApp('/products')
    await screen.findByRole('table')
    await user.selectOptions(screen.getByLabelText('Category'), 'Bakery')
    await user.selectOptions(screen.getByLabelText('Type'), 'food')
    await user.selectOptions(screen.getByLabelText('Sort by'), '-price')
    await waitFor(() =>
      expect(router.state.location.search).toBe('?category=2&type=food&sort=-price'),
    )
    const sent = new URL(lastRequest(calls, 'GET', '/api/products/')!.url).searchParams
    expect(Object.fromEntries(sent)).toMatchObject({
      category: '2',
      product_type: 'food',
      ordering: '-price',
      is_active: 'true',
    })
  })

  it('is read-only for cashiers, without costs', async () => {
    const noCosts = PRODUCTS.map(({ current_cost_price: _c, ...p }) => p)
    setup('cashier', { 'GET /api/products/': () => page(noCosts) })
    renderApp('/products')
    const table = await screen.findByRole('table')
    expect(within(table).queryByText('Margin')).not.toBeInTheDocument()
    expect(within(table).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add product' })).not.toBeInTheDocument()
  })
})

describe('adding a product', () => {
  it('validates amounts for the currency and creates it', async () => {
    const calls = setup('inventory_manager', {
      'POST /api/products/': () => json(product(99, 'Mocha'), 201),
    })
    const { user } = renderApp('/products')
    await user.click(await screen.findByRole('button', { name: 'Add product' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add a product' })
    // Deactivated categories are not offered for new products.
    const options = within(within(dialog).getByLabelText('Category'))
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(options).toEqual(['No category', 'Hot Drinks', 'Bakery'])

    await user.type(within(dialog).getByLabelText('Product name'), 'Mocha')
    await user.type(within(dialog).getByLabelText('SKU'), 'HD-MOC')
    await user.click(within(dialog).getByRole('button', { name: 'Add product' }))
    expect(await within(dialog).findByText('Enter an amount.')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Selling price'), '3200.5')
    await user.click(within(dialog).getByRole('button', { name: 'Add product' }))
    expect(await within(dialog).findByText(/whole amount/)).toBeInTheDocument()

    await user.clear(within(dialog).getByLabelText('Selling price'))
    await user.type(within(dialog).getByLabelText('Selling price'), '3200')
    await user.type(within(dialog).getByLabelText('Cost price'), '1100')
    expect(within(dialog).getByText('Margin: 66%')).toBeInTheDocument()
    await user.selectOptions(within(dialog).getByLabelText('Category'), 'Hot Drinks')
    await user.click(within(dialog).getByRole('button', { name: 'Add product' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await lastRequest(calls, 'POST', '/api/products/')!.json()).toEqual({
      name: 'Mocha',
      sku: 'HD-MOC',
      category: 1,
      product_type: 'drink',
      unit: 'each',
      description: '',
      initial_selling_price: '3200',
      initial_cost_price: '1100',
    })
  })

  it('uploads the photo with the product and checks it first', async () => {
    // jsdom's FormData can't pass through Node's Request (the fake API's
    // transport), so stop at the API call; `withImage` is tested separately.
    vi.mocked(createProduct).mockResolvedValueOnce(product(99, 'Mocha') as never)
    setup('owner')
    const { user } = renderApp('/products')
    await user.click(await screen.findByRole('button', { name: 'Add product' }))
    const dialog = await screen.findByRole('dialog')
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!

    const gif = new File(['GIF89a'], 'cup.gif', { type: 'image/gif' })
    fireEvent.change(input, { target: { files: [gif] } })
    expect(await within(dialog).findByText('Use a PNG, JPEG or WebP image.')).toBeInTheDocument()

    const png = new File(['png'], 'cup.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [png] } })
    expect(await within(dialog).findByRole('button', { name: 'Replace photo' })).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Product name'), 'Mocha')
    await user.type(within(dialog).getByLabelText('SKU'), 'HD-MOC')
    await user.type(within(dialog).getByLabelText('Selling price'), '3200')
    await user.click(within(dialog).getByRole('button', { name: 'Add product' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const [sent, image] = vi.mocked(createProduct).mock.lastCall!
    expect(sent).toMatchObject({ name: 'Mocha', initial_selling_price: '3200', category: null })
    expect(image?.name).toBe('cup.png')
  })

  it('builds a multipart body only when a photo is attached', () => {
    const input = { name: 'Mocha', category: null, initial_selling_price: '3200' }
    expect(withImage(input, null)).toBe(input)
    const photo = new File(['png'], 'cup.png', { type: 'image/png' })
    const form = withImage(input, photo) as unknown as FormData
    expect(form).toBeInstanceOf(FormData)
    expect([...form.keys()]).toEqual(['name', 'initial_selling_price', 'image'])
    expect(form.get('image')).toBe(photo)
  })
})

/** Cappuccino with a scheduled, a current and a past price; off at Nyarutarama. */
const detailHandlers = (extra: Handlers = {}): Handlers => ({
  'GET /api/products/7/': () => json(PRODUCTS[0]),
  'GET /api/products/7/prices/': () =>
    json([
      {
        id: 3,
        selling_price: '3000.0000',
        cost_price: '900.0000',
        effective_from: '2099-01-01T06:00:00Z',
        reason: 'New year',
        created_by: 1,
        created_by_display: 'aline',
        created_by_name: 'Aline Uwase',
        created_at: '',
      },
      {
        id: 2,
        selling_price: '2800.0000',
        cost_price: '850.0000',
        effective_from: '2026-11-01T06:00:00Z',
        reason: 'Milk costs',
        created_by: 1,
        created_by_display: 'aline',
        created_by_name: 'Aline Uwase',
        created_at: '',
      },
      {
        id: 1,
        selling_price: '2500.0000',
        cost_price: '800.0000',
        effective_from: '2026-10-01T06:00:00Z',
        reason: 'Initial price',
        created_by: null,
        created_by_display: null,
        created_by_name: null,
        created_at: '',
      },
    ]),
  'GET /api/products/7/availability/': () =>
    json([
      { branch: 1, branch_name: 'Kigali Heights', is_available: true, can_edit: true },
      { branch: 2, branch_name: 'Nyarutarama', is_available: false, can_edit: true },
    ]),
  ...extra,
})

describe('product detail', () => {
  it('labels scheduled, current and past prices', async () => {
    setup('owner', detailHandlers())
    renderApp('/products/7')
    expect(await screen.findByRole('heading', { name: 'Cappuccino' })).toBeInTheDocument()
    await screen.findByText('Scheduled') // history loaded
    // History rows only (the header shows the current price too).
    const [scheduled, current, past] = screen
      .getAllByText(/^RWF (3,000|2,800|2,500)$/)
      .map((el) => el.closest('ol > li'))
      .filter((li): li is HTMLElement => li instanceof HTMLElement)
    expect(within(scheduled!).getByText('Scheduled')).toBeInTheDocument()
    expect(within(scheduled!).getByText('Starts 2099-01-01 08:00')).toBeInTheDocument()
    expect(within(current!).getByText('Current')).toBeInTheDocument()
    expect(within(current!).getByText('Milk costs · by Aline Uwase')).toBeInTheDocument()
    expect(within(past!).queryByText(/Current|Scheduled/)).toBeNull()
  })

  it('schedules a price in shop time', async () => {
    const calls = setup(
      'owner',
      detailHandlers({ 'POST /api/products/7/prices/': () => json({}, 201) }),
    )
    const { user } = renderApp('/products/7')
    await user.click(await screen.findByRole('button', { name: 'Change price' }))
    const dialog = await screen.findByRole('dialog', { name: 'New price for Cappuccino' })
    expect(within(dialog).getByLabelText('Selling price')).toHaveValue('2800')
    await user.clear(within(dialog).getByLabelText('Selling price'))
    await user.type(within(dialog).getByLabelText('Selling price'), '3100')
    await user.click(within(dialog).getByRole('radio', { name: 'Later' }))
    fireEvent.change(within(dialog).getByLabelText('Start date and time'), {
      target: { value: '2099-03-01T07:30' },
    })
    await user.type(within(dialog).getByLabelText('Reason (optional)'), 'Spring menu')
    await user.click(within(dialog).getByRole('button', { name: 'Schedule price' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await lastRequest(calls, 'POST', '/api/products/7/prices/')!.json()).toEqual({
      selling_price: '3100',
      cost_price: '850',
      reason: 'Spring menu',
      effective_from: '2099-03-01T05:30:00.000Z', // Kigali is UTC+2
    })
  })

  it('switches a branch on and shows the server’s answer', async () => {
    const calls = setup(
      'owner',
      detailHandlers({
        'PUT /api/products/7/availability/': () =>
          json([
            { branch: 1, branch_name: 'Kigali Heights', is_available: true, can_edit: true },
            { branch: 2, branch_name: 'Nyarutarama', is_available: true, can_edit: true },
          ]),
      }),
    )
    const { user } = renderApp('/products/7')
    const toggle = await screen.findByRole('switch', { name: 'Sell at Nyarutarama' })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    await waitFor(() => expect(toggle).toBeChecked())
    expect(await lastRequest(calls, 'PUT', '/api/products/7/availability/')!.json()).toEqual({
      branches: [{ branch: 2, is_available: true }],
    })
  })

  it('shows a not-found state for a missing product', async () => {
    setup('owner', {
      'GET /api/products/404/': () => json({ error: 'Not found.', details: {} }, 404),
    })
    renderApp('/products/404')
    expect(await screen.findByText('Product not found')).toBeInTheDocument()
  })
})

describe('categories', () => {
  it('lists product counts and shows a duplicate name on the field', async () => {
    setup('owner', {
      'POST /api/categories/': () =>
        json(
          {
            error: 'Validation error',
            details: { name: ['A category with this name already exists.'] },
          },
          400,
        ),
    })
    const { user } = renderApp('/products/categories')
    const table = await screen.findByRole('table')
    expect(within(table).getByRole('link', { name: '3 products' })).toHaveAttribute(
      'href',
      '/products?category=2',
    )
    await user.click(screen.getByRole('button', { name: 'Add category' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add a category' })
    await user.type(within(dialog).getByLabelText('Category name'), 'bakery')
    await user.click(within(dialog).getByRole('button', { name: 'Add category' }))
    expect(
      await within(dialog).findByText('A category with this name already exists.'),
    ).toBeInTheDocument()
  })

  it('warns how many products a deactivation affects', async () => {
    const calls = setup('owner', {
      'DELETE /api/categories/2/': () => new Response(null, { status: 204 }),
    })
    const { user } = renderApp('/products/categories')
    await user.click(await screen.findByRole('button', { name: 'Deactivate Bakery' }))
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate Bakery?' })
    expect(within(dialog).getByText(/Its 3 products will stop showing/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true))
  })
})
