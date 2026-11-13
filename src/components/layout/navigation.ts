import {
  Banknote,
  Boxes,
  Building2,
  ChartColumn,
  Coffee,
  LayoutDashboard,
  ReceiptText,
  ScrollText,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { can, type Permission, type Role } from '@/features/auth/permissions'

export type NavKey =
  | 'dashboard'
  | 'pos'
  | 'sales'
  | 'cash'
  | 'products'
  | 'inventory'
  | 'expenses'
  | 'reports'
  | 'staff'
  | 'branches'
  | 'settings'
  | 'audit'

export type NavSection = 'overview' | 'sales' | 'stock' | 'finance' | 'admin'

export interface NavItem {
  key: NavKey
  path: string
  icon: LucideIcon
  permission: Permission
  section: NavSection
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    key: 'dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard.view',
    section: 'overview',
  },
  { key: 'pos', path: '/pos', icon: ShoppingCart, permission: 'pos.use', section: 'sales' },
  { key: 'sales', path: '/sales', icon: ReceiptText, permission: 'sales.view', section: 'sales' },
  { key: 'cash', path: '/cash', icon: Banknote, permission: 'cash.view', section: 'sales' },
  {
    key: 'products',
    path: '/products',
    icon: Coffee,
    permission: 'products.view',
    section: 'stock',
  },
  {
    key: 'inventory',
    path: '/inventory',
    icon: Boxes,
    permission: 'inventory.view',
    section: 'stock',
  },
  {
    key: 'expenses',
    path: '/expenses',
    icon: Wallet,
    permission: 'expenses.view',
    section: 'finance',
  },
  {
    key: 'reports',
    path: '/reports',
    icon: ChartColumn,
    permission: 'reports.view',
    section: 'finance',
  },
  { key: 'staff', path: '/staff', icon: Users, permission: 'staff.manage', section: 'admin' },
  {
    key: 'branches',
    path: '/branches',
    icon: Building2,
    permission: 'branches.view',
    section: 'admin',
  },
  {
    key: 'settings',
    path: '/settings',
    icon: Settings,
    permission: 'settings.manage',
    section: 'admin',
  },
  { key: 'audit', path: '/audit', icon: ScrollText, permission: 'audit.view', section: 'admin' },
]

const SECTION_ORDER: readonly NavSection[] = ['overview', 'sales', 'stock', 'finance', 'admin']

/** Navigation for a role, grouped by section, empty sections removed. */
export function navigationFor(role: Role) {
  const allowed = NAV_ITEMS.filter((item) => can(role, item.permission))
  return SECTION_ORDER.map((section) => ({
    section,
    items: allowed.filter((item) => item.section === section),
  })).filter((group) => group.items.length > 0)
}
