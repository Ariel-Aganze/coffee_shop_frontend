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
  | 'products.availability'
  | 'inventory.view'
  | 'inventory.manage'
  | 'expenses.view'
  | 'expenses.create'
  | 'expenses.approve'
  | 'reports.view'
  | 'staff.manage'
  | 'branches.view'
  | 'branches.create'
  | 'branches.edit'
  | 'branches.deactivate'
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
    'products.availability',
    'inventory.view',
    'inventory.manage',
    'expenses.view',
    'expenses.create',
    'expenses.approve',
    'reports.view',
    'staff.manage',
    'branches.view',
    'branches.create',
    'branches.edit',
    'branches.deactivate',
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
    'branches.edit',
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
    'products.availability',
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
    'products.availability',
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

/**
 * Cost prices reveal margins: every role that manages products, stock or
 * money sees them; cashiers only sell (the API leaves the fields out).
 */
export function canSeeCosts(role: Role | undefined): boolean {
  return role !== undefined && role !== 'cashier'
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

/** Roles a branch manager may create and manage (mirrors the API). */
export const BRANCH_MANAGED_ROLES: readonly Role[] = ['cashier', 'inventory_manager']

/**
 * Whether `actor` may edit / deactivate / set the password of `target`.
 * Mirrors UserViewSet._check_can_manage: the owner manages everyone; admins
 * everyone except owners and admins; branch managers only cashiers and
 * inventory managers (the API already limits them to their branches).
 */
export function canManageUser(actor: { role: Role }, target: { role: Role }): boolean {
  if (actor.role === 'owner') return true
  if (target.role === 'owner' || target.role === 'admin') return false
  if (actor.role === 'admin') return true
  if (actor.role === 'branch_manager') return BRANCH_MANAGED_ROLES.includes(target.role)
  return false
}

/** Roles `actor` may give to someone (create or edit). Nobody can grant "owner". */
export function assignableRoles(actor: { role: Role }): Role[] {
  switch (actor.role) {
    case 'owner':
      return ['admin', 'branch_manager', 'cashier', 'inventory_manager', 'accountant']
    case 'admin':
      return ['branch_manager', 'cashier', 'inventory_manager', 'accountant']
    case 'branch_manager':
      return [...BRANCH_MANAGED_ROLES]
    default:
      return []
  }
}
