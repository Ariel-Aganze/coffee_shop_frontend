import { CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { getErrorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/cn'

/**
 * Grey placeholder rows while a list loads (keeps the layout from jumping).
 * role="status" (not <output>) for reliable announcements — see Loader.
 */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  const { t } = useTranslation()
  return (
    <div role="status" aria-label={t('app.loading')} className={cn('flex flex-col', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border px-6 py-4 last:border-0"
        >
          <span className="size-10 shrink-0 animate-pulse rounded-full bg-surface-muted" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3.5 w-1/3 animate-pulse rounded bg-surface-muted" />
            <span className="h-3 w-1/5 animate-pulse rounded bg-surface-muted" />
          </span>
        </div>
      ))}
    </div>
  )
}

/** A list failed to load: say so and offer to retry. */
export function ListError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <CircleAlert className="size-8 text-danger" aria-hidden="true" />
      <p className="text-sm text-ink">{getErrorMessage(error)}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {t('list.retry')}
      </Button>
    </div>
  )
}
