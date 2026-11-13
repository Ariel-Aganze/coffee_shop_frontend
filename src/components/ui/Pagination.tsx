import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { PAGE_SIZE_OPTIONS } from '@/hooks/usePaginationParams'
import { cn } from '@/lib/cn'

import { pageWindow } from './pageWindow'

interface PaginationProps {
  page: number
  pageSize: number
  /** Total number of items (the API's `count`). */
  count: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  className?: string
}

const pageButton =
  'grid h-10 min-w-10 place-items-center rounded-xl px-2 text-sm font-medium transition-colors'

export function Pagination({
  page,
  pageSize,
  count,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationProps) {
  const { t } = useTranslation()
  const sizeId = useId()
  const pages = Math.max(1, Math.ceil(count / pageSize))
  const current = Math.min(page, pages)
  const from = count === 0 ? 0 : (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, count)

  return (
    <nav
      aria-label={t('pagination.label')}
      className={cn(
        'flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-ink-muted">
        <p aria-live="polite">
          {count === 0 ? t('pagination.noResults') : t('pagination.showing', { from, to, count })}
        </p>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label htmlFor={sizeId}>{t('pagination.perPage')}</label>
            <select
              id={sizeId}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-ink"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(current - 1)}
            disabled={current <= 1}
            aria-label={t('pagination.previous')}
            className={cn(pageButton, 'text-ink hover:bg-surface-muted disabled:opacity-40')}
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>

          {/* Phones: compact "Page 2 of 7"; larger screens: page numbers. */}
          <span className="px-2 text-sm text-ink sm:hidden">
            {t('pagination.pageOf', { page: current, pages })}
          </span>
          <ul className="hidden items-center gap-1 sm:flex">
            {pageWindow(current, pages).map((p, i) =>
              p === null ? (
                <li key={`gap-${i}`} className="px-1 text-ink-subtle" aria-hidden="true">
                  …
                </li>
              ) : (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => onPageChange(p)}
                    aria-label={t('pagination.goToPage', { page: p })}
                    aria-current={p === current ? 'page' : undefined}
                    className={cn(
                      pageButton,
                      p === current
                        ? 'bg-primary text-primary-foreground'
                        : 'text-ink hover:bg-surface-muted',
                    )}
                  >
                    {p}
                  </button>
                </li>
              ),
            )}
          </ul>

          <button
            type="button"
            onClick={() => onPageChange(current + 1)}
            disabled={current >= pages}
            aria-label={t('pagination.next')}
            className={cn(pageButton, 'text-ink hover:bg-surface-muted disabled:opacity-40')}
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  )
}
