import { createContext, use } from 'react'

import type { Formatters } from '@/lib/format'

import type { Branch, Business, BusinessSettings } from './api'

export interface BusinessContextValue {
  business: Business | undefined
  settings: BusinessSettings | undefined
  branches: Branch[]
  /** null = all branches (only possible when `canSelectAll`). */
  branchId: number | null
  branch: Branch | null
  canSelectAll: boolean
  setBranchId: (id: number | null) => void
  format: Formatters
  isLoading: boolean
}

export const BusinessContext = createContext<BusinessContextValue | null>(null)

export function useBusiness(): BusinessContextValue {
  const context = use(BusinessContext)
  if (!context) throw new Error('useBusiness must be used inside <BusinessProvider>')
  return context
}

/** Formatters for money, numbers and dates using the business settings. */
export function useFormat(): Formatters {
  return useBusiness().format
}
