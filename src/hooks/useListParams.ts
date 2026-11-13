import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { usePaginationParams } from './usePaginationParams'

/**
 * A list's filters + pagination, all in the URL (?search=…&role=…&page=2),
 * so filtered lists can be bookmarked, shared and reloaded. Changing a filter
 * goes back to page 1. Values equal to their default are left out of the URL.
 */
export function useListParams<K extends string>(
  keys: readonly K[],
  defaults: Partial<Record<K, string>> = {},
) {
  const [searchParams, setSearchParams] = useSearchParams()
  const pagination = usePaginationParams()
  const defaultsKey = JSON.stringify(defaults)

  const filters = useMemo(() => {
    const fallback = JSON.parse(defaultsKey) as Partial<Record<K, string>>
    return Object.fromEntries(
      keys.map((key) => [key, searchParams.get(key) ?? fallback[key] ?? '']),
    ) as Record<K, string>
  }, [keys, searchParams, defaultsKey])

  const setFilter = useCallback(
    (key: K, value: string) => {
      const fallback = (JSON.parse(defaultsKey) as Partial<Record<K, string>>)[key] ?? ''
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value === fallback) next.delete(key)
          else next.set(key, value)
          next.delete('page')
          return next
        },
        { replace: true }, // typing in a search box shouldn't flood the history
      )
    },
    [setSearchParams, defaultsKey],
  )

  const hasActiveFilters = keys.some((key) => (searchParams.get(key) ?? '') !== '')

  return { filters, setFilter, hasActiveFilters, ...pagination }
}
