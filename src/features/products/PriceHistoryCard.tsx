import { useQuery } from '@tanstack/react-query'
import { Tag } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListError, ListSkeleton } from '@/components/feedback/ListStates'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { canSeeCosts, can } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useFormat } from '@/features/business/useBusiness'

import { fetchPrices, productKeys, type Product, type ProductPrice } from './api'
import { marginRatio } from '@/lib/amount'
import { PriceDialog } from './PriceDialog'

type PriceState = 'scheduled' | 'current' | 'past'

/** Scheduled (not started), the current one, or past. Rows are newest-first. */
function states(rows: ProductPrice[], at: number): PriceState[] {
  let currentFound = false
  return rows.map((row) => {
    if (new Date(row.effective_from).getTime() > at) return 'scheduled'
    if (currentFound) return 'past'
    currentFound = true
    return 'current'
  })
}

/**
 * Every price the product has had (PROD-006, PROD-009). Rows are never
 * edited: a change adds a row, so past sales keep the price they used.
 */
export function PriceHistoryCard({ product }: { product: Product }) {
  const { t } = useTranslation()
  const format = useFormat()
  const user = useCurrentUser()
  const showCosts = canSeeCosts(user.role)
  const canChange = can(user.role, 'products.manage')
  const [changing, setChanging] = useState(false)
  // "Now" for labelling rows; refreshed whenever the history is refetched.
  const query = useQuery({
    queryKey: productKeys.prices(product.id),
    queryFn: async () => ({ rows: await fetchPrices(product.id), at: Date.now() }),
  })

  const rowStates = query.data ? states(query.data.rows, query.data.at) : []
  const badge: Record<PriceState, React.ReactNode> = {
    scheduled: <Badge tone="info">{t('products.scheduled')}</Badge>,
    current: (
      <Badge tone="success" dot>
        {t('products.current')}
      </Badge>
    ),
    past: null,
  }

  return (
    <Card>
      <CardHeader
        title={t('products.priceHistory')}
        description={t('products.priceHistoryBody')}
        actions={
          canChange && (
            <Button
              size="sm"
              variant="soft"
              onClick={() => setChanging(true)}
              leadingIcon={<Tag className="size-4" aria-hidden="true" />}
            >
              {t('products.changePrice')}
            </Button>
          )
        }
      />
      <div className="p-5 pt-4 sm:px-6">
        {query.isPending ? (
          <ListSkeleton rows={3} />
        ) : query.isError ? (
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.rows.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('products.noPrices')}</p>
        ) : (
          <ol className="flex flex-col divide-y divide-border">
            {query.data.rows.map((row, i) => {
              const state = rowStates[i]!
              const margin = marginRatio(row.selling_price, row.cost_price)
              return (
                <li key={row.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={
                          state === 'past'
                            ? 'font-medium text-ink-muted tabular-nums'
                            : 'font-semibold text-ink tabular-nums'
                        }
                      >
                        {format.money(row.selling_price)}
                      </span>
                      {badge[state]}
                    </span>
                    <span className="text-sm text-ink-muted">
                      {state === 'scheduled'
                        ? t('products.startsOn', { when: format.dateTime(row.effective_from) })
                        : t('products.since', { when: format.dateTime(row.effective_from) })}
                    </span>
                  </div>
                  {showCosts && row.cost_price !== undefined && (
                    <p className="text-sm text-ink-muted">
                      {t('products.costLine', {
                        cost: format.money(row.cost_price),
                        margin: margin === null ? '—' : format.percent(margin * 100),
                      })}
                    </p>
                  )}
                  {(row.reason || row.created_by_name) && (
                    <p className="text-sm text-ink-muted">
                      {[
                        row.reason,
                        row.created_by_name && t('products.by', { name: row.created_by_name }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>
      {canChange && (
        <PriceDialog open={changing} onClose={() => setChanging(false)} product={product} />
      )}
    </Card>
  )
}
