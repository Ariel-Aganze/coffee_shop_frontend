/**
 * What each role may see and do in the UI (SRS 4.2).
 *
 * This only decides what to SHOW. The backend independently enforces every
 * permission (SRS 4.3, "the frontend must not be treated as the security
 * boundary"), and this table mirrors its actual checks so people aren't shown
 * screens or buttons that would then be refused.
 */
import type { Schema } from '@/lib/api/types'

export type Role = Schema<'RoleEnum'>

export type Permission =
  | 'dashboard.view'
  | 'pos.use'
  | 'sales.view'
  | 'sales.refund'
  | 'cash.view'
  | 'products.view'
  | 'products.manage'
  | 'inventory.view'
  | 'inventory.manage'
  | 'expenses.view'
  | 'expenses.create'
  | 'expenses.approve'
  | 'reports.view'
  | 'staff.manage'
  | 'branches.view'
  | 'branches.manage'
  | 'settings.manage'
  | 'currency.change'
  | 'audit.view'

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: [
    'dashboard.view',
    'pos.use',
    'sales.view',
    'sales.refund',
    'cash.view',
    'products.view',
    'products.manage',
    'inventory.view',
    'inventory.manage',
    'expenses.view',
    'expenses.create',
    'expenses.approve',
    'reports.view',
    'staff.manage',
    'branches.view',
    'branches.manage',
    'settings.manage',
    'currency.change',
    'audit.view',
  ],
  // Technical administrator: no selling or stock moves, no currency change,
  // financial data only for branches they are assigned to (SRS 4.1.2).
  admin: [
    'dashboard.view',
    'sales.view',
    'cash.view',
    'products.view',
    'inventory.view',
    'expenses.view',
    'reports.view',
    'staff.manage',
    'branches.view',
    'branches.manage',
    'settings.manage',
    'audit.view',
  ],
  branch_manager: [
    'dashboard.view',
    'pos.use',
    'sales.view',
    'sales.refund',
    'cash.view',
    'products.view',
    'inventory.view',
    'inventory.manage',
    'expenses.view',
    'expenses.create',
    'expenses.approve',
    'reports.view',
    'staff.manage',
    'branches.view',
    'audit.view',
  ],
  // Reports for a cashier are limited to their own sales by the backend.
  cashier: ['pos.use', 'sales.view', 'cash.view', 'products.view', 'reports.view'],
  // Reports for an inventory manager are limited to inventory reports.
  inventory_manager: [
    'products.view',
    'products.manage',
    'inventory.view',
    'inventory.manage',
    'expenses.view',
    'expenses.create',
    'reports.view',
    'branches.view',
    'audit.view',
  ],
  accountant: [
    'dashboard.view',
    'sales.view',
    'cash.view',
    'products.view',
    'inventory.view',
    'expenses.view',
    'expenses.create',
    'reports.view',
    'branches.view',
    'audit.view',
  ],
}

export function can(role: Role | undefined, permission: Permission): boolean {
  return role ? ROLE_PERMISSIONS[role].includes(permission) : false
}

/** Where each role lands after signing in (their main daily screen). */
export function homePathFor(role: Role): string {
  switch (role) {
    case 'cashier':
      return '/pos'
    case 'inventory_manager':
      return '/inventory'
    default:
      return '/dashboard'
  }
}

/**
 * Whether the user sees every branch of the business (can pick "All branches").
 * Mirrors the backend's accessible_branch_ids(): the owner always; an
 * accountant when not limited to specific branches.
 */
export function hasBusinessWideAccess(user: { role: Role; branch_ids: readonly number[] }) {
  return user.role === 'owner' || (user.role === 'accountant' && user.branch_ids.length === 0)
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Business owner',
  admin: 'System administrator',
  branch_manager: 'Branch manager',
  cashier: 'Cashier',
  inventory_manager: 'Inventory manager',
  accountant: 'Accountant',
}
