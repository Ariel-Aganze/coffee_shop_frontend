import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ListError, ListSkeleton } from '@/components/feedback/ListStates'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

import { fetchAvailability, productKeys, setAvailability, type Product } from './api'

/** Where the product is sold (PROD-008). No setting at a branch = sold there. */
export function AvailabilityCard({ product }: { product: Product }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: productKeys.availability(product.id),
    queryFn: () => fetchAvailability(product.id),
  })
  const toggle = useMutation({
    mutationFn: ({ branch, on }: { branch: number; name: string; on: boolean }) =>
      setAvailability(product.id, branch, on),
    onSuccess: (rows, { name, on }) => {
      queryClient.setQueryData(productKeys.availability(product.id), rows)
      // Lists and the detail show "not sold at …" badges.
      void queryClient.invalidateQueries({
        queryKey: productKeys.all,
        predicate: (q) => q.queryKey[3] !== 'availability',
      })
      toast.success(
        on
          ? t('products.nowSoldAt', { name: product.name, branch: name })
          : t('products.noLongerSoldAt', { name: product.name, branch: name }),
      )
    },
  })

  return (
    <Card>
      <CardHeader title={t('products.availability')} description={t('products.availabilityBody')} />
      <div className="p-5 pt-4 sm:px-6">
        {!product.is_active && (
          <Alert tone="info" className="mb-4">
            {t('products.inactiveNotSold')}
          </Alert>
        )}
        {query.isPending ? (
          <ListSkeleton rows={2} />
        ) : query.isError ? (
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('products.noBranches')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {query.data.map((row) => {
              const pending = toggle.isPending && toggle.variables?.branch === row.branch
              return (
                <li key={row.branch} className="flex items-center justify-between gap-3 py-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <Store className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{row.branch_name}</span>
                      <span
                        className={cn(
                          'text-xs',
                          row.is_available ? 'text-success' : 'text-ink-muted',
                        )}
                      >
                        {row.is_available ? t('products.sold') : t('products.notSold')}
                      </span>
                    </span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={row.is_available}
                    aria-label={t('products.sellAt', { branch: row.branch_name })}
                    disabled={!row.can_edit || pending}
                    onClick={() =>
                      toggle.mutate({
                        branch: row.branch,
                        name: row.branch_name,
                        on: !row.is_available,
                      })
                    }
                    className={cn(
                      'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
                      'focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:outline-none',
                      'disabled:cursor-not-allowed disabled:opacity-60',
                      row.is_available ? 'bg-primary' : 'bg-border',
                      pending && 'animate-pulse',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block size-5 rounded-full bg-white shadow transition-transform',
                        row.is_available ? 'translate-x-6' : 'translate-x-1',
                      )}
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Card>
  )
}
