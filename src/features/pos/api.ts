import { api, unwrap } from '@/lib/api/client'
import type { Schema } from '@/lib/api/types'

export type Catalog = Schema<'PosCatalog'>
export type CatalogProduct = Schema<'_CatalogProduct'>
export type Discount = Schema<'_CatalogDiscount'>
export type PaymentMethodOption = Schema<'_CatalogPaymentMethod'>
export type PaymentMethod = Schema<'PaymentMethodEnum'>
export type Sale = Schema<'SaleRead'>
export type SaleInput = Schema<'SaleCreateRequest'>
export type CashSession = Schema<'CashSession'>

export const posKeys = {
  catalog: (branch: number) => ['pos', 'catalog', branch] as const,
}

export const fetchCatalog = (branch: number) =>
  unwrap(api.GET('/api/pos/catalog/', { params: { query: { branch } } }))

/**
 * Create AND pay a sale in one request. The idempotency key identifies this
 * checkout attempt: resending the same cart with the same key (after a
 * timeout, a double tap…) returns the original sale instead of a duplicate.
 */
export const checkout = (input: SaleInput, idempotencyKey: string) =>
  unwrap(
    api.POST('/api/sales/', {
      body: input,
      params: { header: { 'X-Idempotency-Key': idempotencyKey } },
    }),
  )
