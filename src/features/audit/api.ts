import { api, unwrap } from '@/lib/api/client'
import type { operations, Schema } from '@/lib/api/types'

export type AuditEntry = Schema<'AuditLog'>
export type AuditListParams = NonNullable<operations['audit_list']['parameters']['query']>

export const auditKeys = {
  all: ['audit'] as const,
  list: (params: AuditListParams) => ['audit', 'list', params] as const,
  actions: ['audit', 'actions'] as const,
}

export const fetchAuditPage = (params: AuditListParams) =>
  unwrap(api.GET('/api/audit/', { params: { query: params } }))

export const fetchAuditActions = () => unwrap(api.GET('/api/audit/actions/')) as Promise<string[]>

/** "sale_refunded" → "Sale refunded": the fallback when an action has no translation. */
export const humanize = (code: string) =>
  code.charAt(0).toUpperCase() + code.slice(1).replaceAll('_', ' ')

/** The page showing the affected record, when there is one. */
export function targetLink(entry: Pick<AuditEntry, 'target_type' | 'target_id'>): string | null {
  const id = entry.target_id
  switch (entry.target_type) {
    case 'Sale':
      return `/sales/${id}`
    case 'Expense':
      return `/expenses/${id}`
    case 'Product':
      return `/products/${id}`
    case 'CashSession':
      return `/cash/${id}`
    case 'Inventory': {
      const product = id.split(':')[1] // "branch:product"
      return product ? `/inventory/movements?product=${product}` : null
    }
    default:
      return null
  }
}
