/**
 * Business-wide context for signed-in screens: the business profile, its
 * settings (currency, timezone, formats, language) and the branch the user is
 * working on.
 *
 * Branch scope rules mirror the backend: users with business-wide access
 * (owner; accountant without assigned branches) may pick "All branches";
 * everyone else always works on one of their assigned branches.
 */
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useCurrentUser } from '@/features/auth/useAuth'
import { hasBusinessWideAccess } from '@/features/auth/permissions'
import { setLanguage } from '@/i18n'
import { createFormatters, DEFAULT_FORMAT_SETTINGS } from '@/lib/format'

import { businessKeys, fetchBranches, fetchBusiness, fetchSettings } from './api'
import { BusinessContext, type BusinessContextValue } from './useBusiness'

const storageKey = (userId: number) => `caffio.branch.${userId}`

function readStoredBranch(userId: number): number | null | undefined {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (raw === null) return undefined
    return raw === 'all' ? null : Number(raw)
  } catch {
    return undefined
  }
}

export function BusinessProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser()
  const businessQuery = useQuery({ queryKey: businessKeys.profile, queryFn: fetchBusiness })
  const settingsQuery = useQuery({ queryKey: businessKeys.settings, queryFn: fetchSettings })
  const branchesQuery = useQuery({ queryKey: businessKeys.branches, queryFn: fetchBranches })

  const settings = settingsQuery.data
  const branches = useMemo(
    () => (branchesQuery.data ?? []).filter((b) => b.is_active),
    [branchesQuery.data],
  )
  const canSelectAll = hasBusinessWideAccess(user)

  const [chosen, setChosen] = useState<number | null | undefined>(() => readStoredBranch(user.id))

  // Resolve the effective branch: the stored choice if still valid, otherwise
  // "all" for business-wide users, otherwise their first branch.
  const branchId = useMemo<number | null>(() => {
    if (chosen === null && canSelectAll) return null
    if (typeof chosen === 'number' && branches.some((b) => b.id === chosen)) return chosen
    return canSelectAll ? null : (branches[0]?.id ?? null)
  }, [chosen, canSelectAll, branches])

  const setBranchId = useCallback(
    (id: number | null) => {
      setChosen(id)
      try {
        localStorage.setItem(storageKey(user.id), id === null ? 'all' : String(id))
      } catch {
        // storage unavailable: the choice lasts for this tab
      }
    },
    [user.id],
  )

  useEffect(() => {
    if (settings?.language) setLanguage(settings.language)
  }, [settings?.language])

  const format = useMemo(
    () =>
      createFormatters(
        settings
          ? {
              currencyCode: settings.primary_currency.code,
              currencyDecimals: settings.primary_currency.decimal_places,
              timezone: settings.timezone,
              numberFormat: settings.number_format,
              dateFormat: settings.date_format,
              language: settings.language,
            }
          : DEFAULT_FORMAT_SETTINGS,
      ),
    [settings],
  )

  const value = useMemo<BusinessContextValue>(
    () => ({
      business: businessQuery.data,
      settings,
      branches,
      branchId,
      branch: branches.find((b) => b.id === branchId) ?? null,
      canSelectAll,
      setBranchId,
      format,
      isLoading: businessQuery.isPending || settingsQuery.isPending || branchesQuery.isPending,
    }),
    [
      businessQuery.data,
      businessQuery.isPending,
      settings,
      settingsQuery.isPending,
      branches,
      branchesQuery.isPending,
      branchId,
      canSelectAll,
      setBranchId,
      format,
    ],
  )

  return <BusinessContext value={value}>{children}</BusinessContext>
}
