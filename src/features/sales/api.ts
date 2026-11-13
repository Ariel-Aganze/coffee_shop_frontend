import { api, unwrap } from '@/lib/api/client'
import type { operations, Schema } from '@/lib/api/types'

export type Sale = Schema<'SaleRead'>
export type SaleListParams = NonNullable<operations['sales_list']['parameters']['query']>

export const saleKeys = {
  all: ['sales'] as const,
  list: (params: SaleListParams) => ['sales', 'list', params] as const,
  detail: (id: number) => ['sales', 'detail', id] as const,
}

export const fetchSalePage = (params: SaleListParams) =>
  unwrap(api.GET('/api/sales/', { params: { query: params } }))

export const fetchSale = (id: number) =>
  unwrap(api.GET('/api/sales/{id}/', { params: { path: { id } } }))

export const refundSale = (
  id: number,
  input: { amount: string; reason: string; restock: boolean },
) => unwrap(api.POST('/api/sales/{id}/refund/', { params: { path: { id } }, body: input }))

export const cancelSale = (id: number, reason: string) =>
  unwrap(api.POST('/api/sales/{id}/cancel/', { params: { path: { id } }, body: { reason } }))

export type SaleState = 'paid' | 'unpaid' | 'partly-refunded' | 'refunded' | 'cancelled'

/** One word for where the sale stands, from its status and payments. */
export function saleState(sale: Sale): SaleState {
  if (sale.status === 'cancelled') return 'cancelled'
  if (sale.status === 'refunded') return 'refunded'
  if (Number(sale.balance_due) > 0) return 'unpaid'
  if (Number(sale.refunded_amount) > 0) return 'partly-refunded'
  return 'paid'
}
