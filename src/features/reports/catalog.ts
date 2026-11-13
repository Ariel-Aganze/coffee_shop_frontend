/**
 * Every report the app offers (SRS 5.11, REP-001..REP-018), described as
 * data: where it comes from, who may open it, its filters and its columns.
 * One generic page renders them all.
 *
 * Roles mirror the backend (apps/reports/views.py): management sees
 * everything; cashiers see sales reports limited to their own sales;
 * inventory managers see inventory reports.
 */
import type { Role } from '@/features/auth/permissions'

import type { ReportPath } from './api'

const MANAGEMENT: Role[] = ['owner', 'admin', 'branch_manager', 'accountant']
const SALES: Role[] = [...MANAGEMENT, 'cashier']
const INVENTORY: Role[] = [...MANAGEMENT, 'inventory_manager']

export type ColumnKind =
  | 'text'
  | 'money' // in the row's currency
  | 'int'
  | 'qty' // with the row's unit
  | 'signedQty'
  | 'signedMoney'
  | 'date'
  | 'datetime'
  | 'period' // period_start – period_end
  | 'badge'

export interface Column {
  key: string
  kind: ColumnKind
  /** Secondary text under the value (e.g. SKU under the product name). */
  sub?: string
  /** Sum this column in a totals row. */
  total?: boolean
  /** Translation prefix for badge values, e.g. 'stock.types'. */
  badge?: string
  /** Hide below this breakpoint in the table. */
  hideBelow?: 'lg' | 'xl'
}

export type FilterKind =
  'period' | 'salesGroup' | 'expenseGroup' | 'expenseStatus' | 'cashStatus' | 'movementType'

export type ReportSlug =
  | 'sales-summary'
  | 'sales-over-time'
  | 'sales-by-branch'
  | 'sales-by-product'
  | 'sales-by-cashier'
  | 'sales-by-payment-method'
  | 'current-stock'
  | 'low-stock'
  | 'stock-movements'
  | 'financial-summary'
  | 'expenses'
  | 'cash-reconciliation'
  | 'branch-comparison'

export interface ReportDef {
  slug: ReportSlug
  path: ReportPath
  section: 'sales' | 'inventory' | 'finance'
  roles: Role[]
  filters: FilterKind[]
  /** Uses the header's branch picker. */
  branchScoped: boolean
  /** 'figures' for one-row summaries, 'table' otherwise. */
  layout: 'table' | 'figures'
  columns: Column[]
  /** Draw the net-sales chart above the table. */
  chart?: boolean
}

export const REPORTS: ReportDef[] = [
  {
    slug: 'sales-summary',
    path: '/api/reports/sales/summary/',
    section: 'sales',
    roles: SALES,
    filters: ['period'],
    branchScoped: true,
    layout: 'figures',
    columns: [
      { key: 'net_sales', kind: 'money' },
      { key: 'total_sales', kind: 'money' },
      { key: 'refunds_total', kind: 'money' },
      { key: 'transactions', kind: 'int' },
      { key: 'average_transaction_value', kind: 'money' },
      { key: 'unpaid_sales_count', kind: 'int' },
      { key: 'unpaid_sales_total', kind: 'money' },
    ],
  },
  {
    slug: 'sales-over-time',
    path: '/api/reports/sales/over-time/',
    section: 'sales',
    roles: SALES,
    filters: ['period', 'salesGroup'],
    branchScoped: true,
    layout: 'table',
    chart: true,
    columns: [
      { key: 'period_start', kind: 'period' },
      { key: 'transactions', kind: 'int', total: true },
      { key: 'total_sales', kind: 'money', total: true, hideBelow: 'lg' },
      { key: 'refunds_total', kind: 'money', total: true, hideBelow: 'lg' },
      { key: 'net_sales', kind: 'money', total: true },
      { key: 'average_transaction_value', kind: 'money', hideBelow: 'xl' },
    ],
  },
  {
    slug: 'sales-by-branch',
    path: '/api/reports/sales/by-branch/',
    section: 'sales',
    roles: SALES,
    filters: ['period'],
    branchScoped: true,
    layout: 'table',
    columns: [
      { key: 'branch_name', kind: 'text' },
      { key: 'transactions', kind: 'int', total: true },
      { key: 'total_sales', kind: 'money', total: true, hideBelow: 'lg' },
      { key: 'refunds_total', kind: 'money', total: true, hideBelow: 'lg' },
      { key: 'net_sales', kind: 'money', total: true },
    ],
  },
  {
    slug: 'sales-by-product',
    path: '/api/reports/sales/by-product/',
    section: 'sales',
    roles: SALES,
    filters: ['period'],
    branchScoped: true,
    layout: 'table',
    columns: [
      { key: 'product_name', kind: 'text', sub: 'sku' },
      { key: 'orders', kind: 'int', total: true, hideBelow: 'lg' },
      { key: 'quantity_sold', kind: 'int', total: true },
      { key: 'revenue', kind: 'money', total: true },
    ],
  },
  {
    slug: 'sales-by-cashier',
    path: '/api/reports/sales/by-cashier/',
    section: 'sales',
    roles: MANAGEMENT,
    filters: ['period'],
    branchScoped: true,
    layout: 'table',
    columns: [
      { key: 'cashier_name', kind: 'text' },
      { key: 'transactions', kind: 'int', total: true },
      { key: 'total_sales', kind: 'money', total: true, hideBelow: 'lg' },
      { key: 'refunds_total', kind: 'money', total: true, hideBelow: 'lg' },
      { key: 'net_sales', kind: 'money', total: true },
    ],
  },
  {
    slug: 'sales-by-payment-method',
    path: '/api/reports/sales/by-payment-method/',
    section: 'sales',
    roles: SALES,
    filters: ['period'],
    branchScoped: true,
    layout: 'table',
    columns: [
      { key: 'method', kind: 'badge', badge: 'payments' },
      { key: 'count', kind: 'int', total: true },
      { key: 'collected', kind: 'money', total: true, hideBelow: 'lg' },
      { key: 'refunded', kind: 'money', total: true, hideBelow: 'lg' },
      { key: 'net', kind: 'money', total: true },
    ],
  },
  {
    slug: 'current-stock',
    path: '/api/reports/inventory/current-stock/',
    section: 'inventory',
    roles: INVENTORY,
    filters: [],
    branchScoped: true,
    layout: 'table',
    columns: [
      { key: 'product_name', kind: 'text', sub: 'sku' },
      { key: 'branch_name', kind: 'text', hideBelow: 'lg' },
      { key: 'quantity', kind: 'qty' },
      { key: 'minimum_threshold', kind: 'qty', hideBelow: 'lg' },
      { key: 'unit_cost', kind: 'money', hideBelow: 'xl' },
      { key: 'stock_value', kind: 'money', total: true },
    ],
  },
  {
    slug: 'low-stock',
    path: '/api/reports/inventory/low-stock/',
    section: 'inventory',
    roles: INVENTORY,
    filters: [],
    branchScoped: true,
    layout: 'table',
    columns: [
      { key: 'product_name', kind: 'text', sub: 'sku' },
      { key: 'branch_name', kind: 'text' },
      { key: 'quantity', kind: 'qty' },
      { key: 'minimum_threshold', kind: 'qty' },
    ],
  },
  {
    slug: 'stock-movements',
    path: '/api/reports/inventory/movements/',
    section: 'inventory',
    roles: INVENTORY,
    filters: ['period', 'movementType'],
    branchScoped: true,
    layout: 'table',
    columns: [
      { key: 'created_at', kind: 'datetime' },
      { key: 'product_name', kind: 'text', sub: 'branch_name' },
      { key: 'movement_type', kind: 'badge', badge: 'stock.types' },
      { key: 'delta', kind: 'signedQty' },
      { key: 'quantity_after', kind: 'qty', hideBelow: 'lg' },
      { key: 'reason', kind: 'text', sub: 'reference', hideBelow: 'xl' },
      { key: 'performed_by', kind: 'text', hideBelow: 'lg' },
    ],
  },
  {
    slug: 'financial-summary',
    path: '/api/reports/financial/summary/',
    section: 'finance',
    roles: MANAGEMENT,
    filters: ['period'],
    branchScoped: true,
    layout: 'figures',
    columns: [
      { key: 'revenue', kind: 'money' },
      { key: 'gross_sales', kind: 'money' },
      { key: 'refunds', kind: 'money' },
      { key: 'cost_of_goods_sold', kind: 'money' },
      { key: 'gross_profit', kind: 'money' },
      { key: 'operating_expenses', kind: 'money' },
      { key: 'operating_result', kind: 'signedMoney' },
    ],
  },
  {
    slug: 'expenses',
    path: '/api/reports/expenses/',
    section: 'finance',
    roles: MANAGEMENT,
    filters: ['period', 'expenseGroup', 'expenseStatus'],
    branchScoped: true,
    layout: 'table',
    columns: [
      { key: 'group', kind: 'text' },
      { key: 'status', kind: 'badge', badge: 'expenses.status' },
      { key: 'count', kind: 'int', total: true },
      { key: 'total', kind: 'money', total: true },
    ],
  },
  {
    slug: 'cash-reconciliation',
    path: '/api/reports/cash/reconciliation/',
    section: 'finance',
    roles: MANAGEMENT,
    filters: ['period', 'cashStatus'],
    branchScoped: true,
    layout: 'table',
    columns: [
      { key: 'opened_at', kind: 'datetime' },
      { key: 'cashier', kind: 'text', sub: 'branch_name' },
      { key: 'status', kind: 'badge', badge: 'cash.status' },
      { key: 'opening_balance', kind: 'money', hideBelow: 'xl' },
      { key: 'expected_cash', kind: 'money', hideBelow: 'lg' },
      { key: 'actual_cash', kind: 'money', hideBelow: 'lg' },
      { key: 'difference', kind: 'signedMoney', total: true },
      { key: 'discrepancy_explanation', kind: 'text', hideBelow: 'xl' },
    ],
  },
  {
    slug: 'branch-comparison',
    path: '/api/reports/branches/compare/',
    section: 'finance',
    roles: MANAGEMENT,
    filters: ['period'],
    branchScoped: false,
    layout: 'table',
    columns: [
      { key: 'branch_name', kind: 'text' },
      { key: 'transactions', kind: 'int', total: true },
      { key: 'revenue', kind: 'money', total: true },
      { key: 'average_transaction_value', kind: 'money', hideBelow: 'lg' },
      { key: 'refunds', kind: 'money', total: true, hideBelow: 'xl' },
      { key: 'expenses', kind: 'money', total: true },
    ],
  },
]

export const reportsFor = (role: Role) => REPORTS.filter((r) => r.roles.includes(role))
export const findReport = (slug: string | undefined) => REPORTS.find((r) => r.slug === slug)
