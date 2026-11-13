import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Coffee, Pencil, Power, PowerOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { Loader } from '@/components/feedback/Loader'
import { ListError } from '@/components/feedback/ListStates'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { can, canSeeCosts } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useFormat } from '@/features/business/useBusiness'
import { ApiError, getErrorMessage } from '@/lib/api/errors'

import {
  categoryKeys,
  deactivateProduct,
  fetchProduct,
  productKeys,
  updateProduct,
  type Product,
} from './api'
import { AvailabilityCard } from './AvailabilityCard'
import { marginRatio } from '@/lib/amount'
import { PriceHistoryCard } from './PriceHistoryCard'
import { ProductFormDialog } from './ProductFormDialog'
import { ProductThumb } from './ProductThumb'

/** One product: details, prices over time, and where it is sold. */
export function ProductDetailPage() {
  const { t } = useTranslation()
  const id = Number(useParams().productId)
  const query = useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => fetchProduct(id),
    enabled: Number.isInteger(id),
  })

  const back = (
    <Link
      to="/products"
      className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-muted hover:text-ink"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t('products.backToList')}
    </Link>
  )

  if (!Number.isInteger(id) || (query.error instanceof ApiError && query.error.status === 404)) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Card>
          <EmptyState
            icon={Coffee}
            title={t('products.notFoundTitle')}
            description={t('products.notFoundBody')}
          />
        </Card>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {back}
      {query.isPending ? (
        <Loader label={t('app.loading')} />
      ) : query.isError ? (
        <Card>
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        </Card>
      ) : (
        <ProductDetail product={query.data} />
      )}
    </div>
  )
}

function ProductDetail({ product }: { product: Product }) {
  const { t } = useTranslation()
  const format = useFormat()
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const canManage = can(user.role, 'products.manage')
  const showCosts = canSeeCosts(user.role)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const afterChange = () => {
    void queryClient.invalidateQueries({ queryKey: productKeys.all })
    void queryClient.invalidateQueries({ queryKey: categoryKeys.all })
  }
  const deactivate = useMutation({
    mutationFn: () => deactivateProduct(product.id),
    onSuccess: () => {
      toast.success(t('products.deactivated', { name: product.name }))
      afterChange()
      setConfirming(false)
    },
    meta: { silentError: true },
  })
  const reactivate = useMutation({
    mutationFn: () => updateProduct(product.id, { is_active: true }),
    onSuccess: () => {
      toast.success(t('products.reactivated', { name: product.name }))
      afterChange()
    },
  })

  const margin = marginRatio(product.current_price, product.current_cost_price)

  return (
    <>
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <ProductThumb
            image={product.image}
            type={product.product_type}
            className="size-24 rounded-2xl sm:size-28"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-ink">{product.name}</h2>
              {!product.is_active && (
                <Badge tone="neutral" dot>
                  {t('list.statusInactive')}
                </Badge>
              )}
            </div>
            <p className="text-sm text-ink-muted">
              {[
                product.sku,
                t(`products.types.${product.product_type}`),
                product.category_name ?? t('products.noCategory'),
              ].join(' · ')}
            </p>
            {product.description && (
              <p className="max-w-prose text-sm text-ink">{product.description}</p>
            )}
            <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <dt className="text-xs text-ink-muted">{t('products.price')}</dt>
                <dd className="text-xl font-semibold text-ink tabular-nums">
                  {product.current_price === null
                    ? t('products.noPrice')
                    : format.money(product.current_price)}
                </dd>
              </div>
              {showCosts && product.current_cost_price !== undefined && (
                <>
                  <div>
                    <dt className="text-xs text-ink-muted">{t('products.costPrice')}</dt>
                    <dd className="text-xl font-semibold text-ink tabular-nums">
                      {format.money(product.current_cost_price)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">{t('products.margin')}</dt>
                    <dd className="text-xl font-semibold text-ink tabular-nums">
                      {margin === null ? '—' : format.percent(margin * 100)}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
              <Button
                variant="secondary"
                onClick={() => setEditing(true)}
                leadingIcon={<Pencil className="size-4" aria-hidden="true" />}
              >
                {t('products.editDetails')}
              </Button>
              {product.is_active ? (
                <Button
                  variant="ghost"
                  onClick={() => setConfirming(true)}
                  leadingIcon={<PowerOff className="size-4" aria-hidden="true" />}
                >
                  {t('products.deactivate')}
                </Button>
              ) : (
                <Button
                  variant="soft"
                  loading={reactivate.isPending}
                  onClick={() => reactivate.mutate()}
                  leadingIcon={<Power className="size-4" aria-hidden="true" />}
                >
                  {t('products.reactivate')}
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <PriceHistoryCard product={product} />
        <AvailabilityCard product={product} />
      </div>

      {canManage && (
        <>
          <ProductFormDialog open={editing} onClose={() => setEditing(false)} product={product} />
          <ConfirmDialog
            open={confirming}
            onClose={() => {
              setConfirming(false)
              deactivate.reset()
            }}
            onConfirm={() => deactivate.mutate()}
            title={t('products.deactivateTitle', { name: product.name })}
            confirmLabel={t('products.deactivate')}
            pending={deactivate.isPending}
            error={deactivate.error ? getErrorMessage(deactivate.error) : null}
          >
            <p>{t('products.deactivateBody')}</p>
          </ConfirmDialog>
        </>
      )}
    </>
  )
}
