import type { QueryClient } from '@tanstack/react-query'

import { posKeys } from '@/features/pos/api'
import { productKeys, type Unit } from '@/features/products/api'
import { api, unwrap } from '@/lib/api/client'
import type { operations, Schema } from '@/lib/api/types'

export type StockRow = Schema<'Inventory'>
export type StockSummary = Schema<'InventorySummary'>
export type Movement = Schema<'StockMovement'>
export type MovementType = Movement['movement_type']
export type InflowType = NonNullable<Schema<'InflowRequest'>['movement_type']>
export type OutflowType = NonNullable<Schema<'OutflowRequest'>['movement_type']>
export type StockListParams = NonNullable<operations['inventory_list']['parameters']['query']>
export type MovementListParams = NonNullable<
  operations['stock_movements_list']['parameters']['query']
>
export type CountResult = Schema<'StockCountResult'>

export const MOVEMENT_TYPES = [
  'purchase',
  'sale',
  'return',
  'adjustment',
  'damaged',
  'expired',
  'transfer_in',
  'transfer_out',
] as const satisfies readonly MovementType[]

/** What can be recorded by hand. Transfers between branches come later (SRS 1.4). */
export const INFLOW_TYPES = [
  'purchase',
  'return',
  'adjustment',
] as const satisfies readonly InflowType[]
export const OUTFLOW_TYPES = [
  'damaged',
  'expired',
  'adjustment',
] as const satisfies readonly OutflowType[]

export const stockKeys = {
  all: ['stock'] as const,
  list: (params: StockListParams) => ['stock', 'list', params] as const,
  summary: (branch: number | null) => ['stock', 'summary', branch] as const,
  movements: (params: MovementListParams) => ['stock', 'movements', params] as const,
  countSheet: (branch: number) => ['stock', 'count-sheet', branch] as const,
}

export const fetchStockPage = (params: StockListParams) =>
  unwrap(api.GET('/api/inventory/', { params: { query: params } }))

export const fetchStockSummary = (branch: number | null) =>
  unwrap(api.GET('/api/inventory/summary/', { params: { query: branch ? { branch } : {} } }))

/** Every tracked product at a branch (for the count sheet), following pages. */
export async function fetchAllStock(branch: number): Promise<StockRow[]> {
  const rows: StockRow[] = []
  for (let page = 1; ; page++) {
    const result = await fetchStockPage({ branch, page, page_size: 100, ordering: 'name' })
    rows.push(...result.results)
    if (!result.next) return rows
  }
}

export const fetchMovementPage = (params: MovementListParams) =>
  unwrap(api.GET('/api/stock-movements/', { params: { query: params } }))

export const receiveStock = (input: Schema<'InflowRequest'>) =>
  unwrap(api.POST('/api/stock-movements/inflow/', { body: input }))

export const removeStock = (input: Schema<'OutflowRequest'>) =>
  unwrap(api.POST('/api/stock-movements/outflow/', { body: input }))

export const setThreshold = (id: number, minimum: string) =>
  unwrap(
    api.PATCH('/api/inventory/{id}/threshold/', {
      params: { path: { id } },
      body: { minimum_threshold: minimum },
    }),
  )

export const submitCount = (input: Schema<'StockCountRequest'>) =>
  unwrap(api.POST('/api/inventory/count/', { body: input }))

/** Stock changed: lists, the summary, the POS catalogue (stock badges) and products. */
export function invalidateStock(queryClient: QueryClient, branch?: number) {
  void queryClient.invalidateQueries({ queryKey: stockKeys.all })
  void queryClient.invalidateQueries({ queryKey: productKeys.all })
  void queryClient.invalidateQueries({
    queryKey: branch ? posKeys.catalog(branch) : ['pos'],
  })
}

/** Whole units for things counted one by one; up to 3 decimals for weights and volumes. */
export const quantityDecimals = (unit: string) =>
  (['kg', 'l'] as readonly string[]).includes(unit) ? 3 : 0

export const asUnit = (unit: string): Unit =>
  (['each', 'kg', 'g', 'l', 'ml', 'pack'] as const).find((u) => u === unit) ?? 'each'
