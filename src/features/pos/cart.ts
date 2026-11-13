/**
 * The POS cart. A line keeps only what the cashier chose (product, quantity,
 * discount); name, price and stock always come from the latest catalogue, so
 * a price change or a product switched off at the branch shows up before the
 * sale is charged rather than being refused by the backend.
 */
import { fromMinor, max, min, percentOf, sum, times, toMinor } from '@/lib/minor'

import type { CatalogProduct, Discount } from './api'

export interface CartLine {
  productId: number
  quantity: number
  /** Line discount as a decimal string in the currency ("0" = none). */
  discount: string
}

export interface PricedLine extends CartLine {
  product: CatalogProduct | undefined
  /** Price × quantity, before discount (minor units). */
  gross: bigint
  discountMinor: bigint
  total: bigint
  /** Most this line can hold: stock on hand for tracked products. */
  maxQuantity: number
  problem: 'unavailable' | 'over-stock' | 'discount-too-big' | null
}

export interface CartTotals {
  subtotal: bigint
  discount: bigint
  total: bigint
  itemCount: number
}

/** Whole units on hand for a tracked product, unlimited (Infinity) otherwise. */
export function stockLimit(product: CatalogProduct | undefined): number {
  if (!product?.stock_tracked || product.stock_quantity === null) return Infinity
  return Math.max(0, Math.floor(Number(product.stock_quantity)))
}

export function addProduct(lines: readonly CartLine[], product: CatalogProduct): CartLine[] {
  const limit = stockLimit(product)
  const existing = lines.find((l) => l.productId === product.id)
  if (existing) {
    return lines.map((l) =>
      l.productId === product.id ? { ...l, quantity: Math.min(l.quantity + 1, limit) } : l,
    )
  }
  if (limit < 1) return [...lines]
  return [...lines, { productId: product.id, quantity: 1, discount: '0' }]
}

export function setQuantity(lines: readonly CartLine[], productId: number, quantity: number) {
  if (quantity < 1) return lines.filter((l) => l.productId !== productId)
  return lines.map((l) => (l.productId === productId ? { ...l, quantity } : l))
}

export function setDiscount(lines: readonly CartLine[], productId: number, discount: string) {
  return lines.map((l) => (l.productId === productId ? { ...l, discount } : l))
}

/** Largest discount allowed on a line (minor units): the line value, or the cashier's % of it. */
export function maxDiscount(gross: bigint, allowance: Discount): bigint {
  if (allowance.unlimited || allowance.max_percent === null) return gross
  return min(gross, percentOf(gross, allowance.max_percent))
}

export function priceLines(
  lines: readonly CartLine[],
  catalogue: ReadonlyMap<number, CatalogProduct>,
  allowance: Discount,
  decimals: number,
): PricedLine[] {
  return lines.map((line) => {
    const product = catalogue.get(line.productId)
    const gross = product ? times(toMinor(product.price, decimals), line.quantity) : 0n
    const discountMinor = max(0n, toMinor(line.discount || '0', decimals))
    const maxQuantity = stockLimit(product)
    let problem: PricedLine['problem'] = null
    if (!product) problem = 'unavailable'
    else if (line.quantity > maxQuantity) problem = 'over-stock'
    else if (discountMinor > maxDiscount(gross, allowance)) problem = 'discount-too-big'
    return {
      ...line,
      product,
      gross,
      discountMinor,
      total: gross - min(discountMinor, gross),
      maxQuantity,
      problem,
    }
  })
}

export function totals(priced: readonly PricedLine[]): CartTotals {
  const subtotal = sum(priced.map((l) => l.gross))
  const discount = sum(priced.map((l) => min(l.discountMinor, l.gross)))
  return {
    subtotal,
    discount,
    total: subtotal - discount,
    itemCount: priced.reduce((n, l) => n + l.quantity, 0),
  }
}

/** Sale items for POST /api/sales/. */
export function toSaleItems(priced: readonly PricedLine[], decimals: number) {
  return priced.map((l) => ({
    product_id: l.productId,
    quantity: String(l.quantity),
    discount_amount: fromMinor(l.discountMinor, decimals),
  }))
}

// ---------- Persistence: survive a reload, per branch and per browser ----------

const storageKey = (branchId: number) => `caffio.pos.cart.${branchId}`

export function loadCart(branchId: number): CartLine[] {
  try {
    const raw = localStorage.getItem(storageKey(branchId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (l): l is CartLine =>
        typeof l === 'object' &&
        l !== null &&
        Number.isInteger((l as CartLine).productId) &&
        Number.isInteger((l as CartLine).quantity) &&
        (l as CartLine).quantity > 0 &&
        typeof (l as CartLine).discount === 'string',
    )
  } catch {
    return []
  }
}

export function saveCart(branchId: number, lines: readonly CartLine[]) {
  try {
    if (lines.length) localStorage.setItem(storageKey(branchId), JSON.stringify(lines))
    else localStorage.removeItem(storageKey(branchId))
  } catch {
    // Private mode / storage full: the cart just won't survive a reload.
  }
}
