import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100 // the API's limit

function positiveInt(raw: string | null, fallback: number): number {
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : fallback
}

/**
 * Page and page size kept in the URL (?page=2&page_size=50), so lists can be
 * bookmarked, shared and navigated with the back button. Returns the query
 * params to send to the API as `apiParams`.
 */
export function usePaginationParams(defaultPageSize: number = DEFAULT_PAGE_SIZE) {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = positiveInt(searchParams.get('page'), 1)
  const pageSize = Math.min(
    positiveInt(searchParams.get('page_size'), defaultPageSize),
    MAX_PAGE_SIZE,
  )

  const update = useCallback(
    (changes: { page?: number; pageSize?: number }) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (changes.pageSize !== undefined) {
            if (changes.pageSize === defaultPageSize) next.delete('page_size')
            else next.set('page_size', String(changes.pageSize))
            next.delete('page') // a new page size starts from the first page
          }
          if (changes.page !== undefined) {
            if (changes.page <= 1) next.delete('page')
            else next.set('page', String(changes.page))
          }
          return next
        },
        { replace: false },
      )
    },
    [setSearchParams, defaultPageSize],
  )

  const setPage = useCallback((value: number) => update({ page: value }), [update])
  const setPageSize = useCallback((value: number) => update({ pageSize: value }), [update])

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    apiParams: { page, page_size: pageSize },
  }
}
