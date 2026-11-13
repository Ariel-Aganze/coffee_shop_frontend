import { beforeEach, describe, expect, it } from 'vitest'

import type { CatalogProduct } from './api'
import {
  addProduct,
  loadCart,
  maxDiscount,
  priceLines,
  saveCart,
  setQuantity,
  toSaleItems,
  totals,
  type CartLine,
} from './cart'

const item = (id: number, price: string, stock: string | null = null): CatalogProduct => ({
  id,
  name: `P${id}`,
  sku: `SKU${id}`,
  description: '',
  image: null,
  category_id: null,
  product_type: 'drink',
  price,
  stock_tracked: stock !== null,
  stock_quantity: stock,
  is_low_stock: false,
  in_stock: stock === null || Number(stock) > 0,
})
const latte = item(1, '2200.0000')
const water = item(2, '500.0000', '3.0000')
const catalogue = new Map([latte, water].map((p) => [p.id, p]))
const cashier = { unlimited: false, max_percent: '10.00' }
const manager = { unlimited: true, max_percent: null }

describe('cart', () => {
  it('adds, increments and caps at stock on hand', () => {
    let lines: CartLine[] = []
    lines = addProduct(lines, latte)
    lines = addProduct(lines, latte)
    for (let i = 0; i < 5; i++) lines = addProduct(lines, water)
    expect(lines).toEqual([
      { productId: 1, quantity: 2, discount: '0' },
      { productId: 2, quantity: 3, discount: '0' },
    ])
    expect(addProduct([], item(3, '1', '0'))).toEqual([]) // out of stock
    expect(setQuantity(lines, 1, 0)).toEqual([lines[1]])
  })

  it('prices lines from the current catalogue, exactly', () => {
    const lines = [
      { productId: 1, quantity: 2, discount: '400' },
      { productId: 2, quantity: 1, discount: '0' },
    ]
    const priced = priceLines(lines, catalogue, manager, 0)
    expect(totals(priced)).toEqual({ subtotal: 4900n, discount: 400n, total: 4500n, itemCount: 3 })
    expect(toSaleItems(priced, 0)).toEqual([
      { product_id: 1, quantity: '2', discount_amount: '400' },
      { product_id: 2, quantity: '1', discount_amount: '0' },
    ])
  })

  it('flags problems the backend would refuse', () => {
    const priced = priceLines(
      [
        { productId: 1, quantity: 1, discount: '300' }, // > 10% of 2200
        { productId: 2, quantity: 4, discount: '0' }, // only 3 on hand
        { productId: 99, quantity: 1, discount: '0' }, // no longer sold here
      ],
      catalogue,
      cashier,
      0,
    )
    expect(priced.map((l) => l.problem)).toEqual(['discount-too-big', 'over-stock', 'unavailable'])
    expect(maxDiscount(2200n, cashier)).toBe(220n)
    expect(maxDiscount(2200n, manager)).toBe(2200n)
  })
})

describe('cart persistence', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips per branch and ignores junk', () => {
    saveCart(1, [{ productId: 1, quantity: 2, discount: '0' }])
    expect(loadCart(1)).toEqual([{ productId: 1, quantity: 2, discount: '0' }])
    expect(loadCart(2)).toEqual([])
    localStorage.setItem(
      'caffio.pos.cart.3',
      '[{"productId":"x"},{"productId":1,"quantity":1,"discount":"0"}]',
    )
    expect(loadCart(3)).toEqual([{ productId: 1, quantity: 1, discount: '0' }])
    localStorage.setItem('caffio.pos.cart.4', 'not json')
    expect(loadCart(4)).toEqual([])
    saveCart(1, [])
    expect(localStorage.getItem('caffio.pos.cart.1')).toBeNull()
  })
})
