import { describe, expect, it } from 'vitest'

import { can, hasBusinessWideAccess, homePathFor } from './permissions'

describe('permissions mirror the backend RBAC', () => {
  it('only roles that can create sales get the POS', () => {
    expect(can('owner', 'pos.use')).toBe(true)
    expect(can('branch_manager', 'pos.use')).toBe(true)
    expect(can('cashier', 'pos.use')).toBe(true)
    expect(can('admin', 'pos.use')).toBe(false)
    expect(can('accountant', 'pos.use')).toBe(false)
    expect(can('inventory_manager', 'pos.use')).toBe(false)
  })

  it('only the owner changes the currency; owner/admin manage settings', () => {
    expect(can('owner', 'currency.change')).toBe(true)
    expect(can('admin', 'currency.change')).toBe(false)
    expect(can('admin', 'settings.manage')).toBe(true)
    expect(can('branch_manager', 'settings.manage')).toBe(false)
  })

  it('cashiers never see the dashboard, staff or audit log', () => {
    for (const p of ['dashboard.view', 'staff.manage', 'audit.view'] as const) {
      expect(can('cashier', p)).toBe(false)
    }
  })

  it('branch permissions follow the API: owner creates/deactivates, admin may edit', () => {
    expect(can('owner', 'branches.create')).toBe(true)
    expect(can('owner', 'branches.deactivate')).toBe(true)
    expect(can('admin', 'branches.edit')).toBe(true)
    expect(can('admin', 'branches.create')).toBe(false)
    expect(can('admin', 'branches.deactivate')).toBe(false)
    expect(can('branch_manager', 'branches.edit')).toBe(false)
  })

  it('product changes are limited to owner and inventory manager (as the API)', () => {
    expect(can('owner', 'products.manage')).toBe(true)
    expect(can('inventory_manager', 'products.manage')).toBe(true)
    expect(can('branch_manager', 'products.manage')).toBe(false)
  })

  it('no permissions without a role', () => {
    expect(can(undefined, 'products.view')).toBe(false)
  })

  it('sends each role to its daily screen', () => {
    expect(homePathFor('cashier')).toBe('/pos')
    expect(homePathFor('inventory_manager')).toBe('/inventory')
    expect(homePathFor('owner')).toBe('/dashboard')
    expect(homePathFor('accountant')).toBe('/dashboard')
  })

  it('business-wide access: owner, and accountants without assigned branches', () => {
    expect(hasBusinessWideAccess({ role: 'owner', branch_ids: [] })).toBe(true)
    expect(hasBusinessWideAccess({ role: 'accountant', branch_ids: [] })).toBe(true)
    expect(hasBusinessWideAccess({ role: 'accountant', branch_ids: [2] })).toBe(false)
    expect(hasBusinessWideAccess({ role: 'admin', branch_ids: [] })).toBe(false)
  })
})
