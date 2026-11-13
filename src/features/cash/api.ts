import { api, unwrap } from '@/lib/api/client'
import type { operations, Schema } from '@/lib/api/types'

export type CashSession = Schema<'CashSession'>
export type CashMovement = Schema<'CashMovement'>
export type Reconciliation = Schema<'Reconciliation'>
export type MovementType = Schema<'CashMovementCreateRequest'>['movement_type']
export type SessionListParams = NonNullable<operations['cash_sessions_list']['parameters']['query']>

export const cashKeys = {
  all: ['cash'] as const,
  list: (params: SessionListParams) => ['cash', 'list', params] as const,
  detail: (id: number) => ['cash', 'detail', id] as const,
  reconciliation: (id: number) => ['cash', 'detail', id, 'reconciliation'] as const,
  /** The signed-in user's open drawer at a branch. */
  mine: (branch: number, user: number) => ['cash', 'mine', branch, user] as const,
}

export const fetchSessionPage = (params: SessionListParams) =>
  unwrap(api.GET('/api/cash-sessions/', { params: { query: params } }))

export const fetchSession = (id: number) =>
  unwrap(api.GET('/api/cash-sessions/{id}/', { params: { path: { id } } }))

/** The user's open session at this branch, or null. */
export async function fetchMyOpenSession(branch: number, user: number) {
  const page = await fetchSessionPage({ branch, cashier: user, status: 'open', page_size: 1 })
  return page.results[0] ?? null
}

export const fetchReconciliation = (id: number) =>
  unwrap(api.GET('/api/cash-sessions/{id}/reconciliation/', { params: { path: { id } } }))

export const openSession = (branch: number, openingBalance: string) =>
  unwrap(
    api.POST('/api/cash-sessions/open/', {
      body: { branch, opening_balance: openingBalance },
    }),
  )

export const addMovement = (
  id: number,
  input: { movement_type: MovementType; amount: string; reason: string; reference?: string },
) =>
  unwrap(api.POST('/api/cash-sessions/{id}/movements/', { params: { path: { id } }, body: input }))

export const closeSession = (id: number, actualCash: string, explanation: string) =>
  unwrap(
    api.POST('/api/cash-sessions/{id}/close/', {
      params: { path: { id } },
      body: { actual_cash: actualCash, explanation },
    }),
  )
