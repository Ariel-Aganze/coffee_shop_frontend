import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Coffee, EyeOff, Pencil, Plus, Power, PowerOff } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { ListError, ListSkeleton } from '@/components/feedback/ListStates'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Segmented } from '@/components/ui/Segmented'
import { SelectField } from '@/components/ui/SelectField'
import { Table, Td, Th } from '@/components/ui/Table'
import { can, canSeeCosts } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useBusiness } from '@/features/business/useBusiness'
import { useListParams } from '@/hooks/useListParams'
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import { getErrorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/cn'

import {
  categoryKeys,
  deactivateProduct,
  fetchCategoryOptions,
  fetchProductPage,
  PRODUCT_TYPES,
  productKeys,
  updateProduct,
  type Product,
  type ProductListParams,
  type ProductType,
} from './api'
import { CatalogTabs } from './CatalogTabs'
import { marginRatio } from './money'
import { ProductFormDialog } from './ProductFormDialog'
import { ProductThumb } from './ProductThumb'

type Status = 'active' | 'inactive' | 'all'
type Sort = NonNullable<ProductListParams['ordering']>
const SORTS: readonly Sort[] = ['name', '-name', '-price', 'price', '-created_at']

/** Thumbnail, linked name and SKU. */
function ProductName({ product, children }: { product: Product; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ProductThumb image={product.image} type={product.product_type} />
      <div className="min-w-0">
        <Link
          to={`/products/${product.id}`}
          className="font-medium text-ink hover:text-primary hover:underline"
        >
          {product.name}
        </Link>
        <p className="truncate text-xs text-ink-muted">{product.sku}</p>
        {/* Status / "not sold at" badges (renders nothing when there are none) */}
        <div className="flex flex-wrap gap-1.5 empty:hidden [&:not(:empty)]:mt-1.5">{children}</div>
      </div>
    </div>
  )
}

/** Products (SRS 5.4): search, filter, add, edit, deactivate / reactivate. */
export function ProductsPage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { branches, format } = useBusiness()
  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery(MD_UP)
  const { filters, setFilter, hasActiveFilters, page, pageSize, setPage, setPageSize } =
    useListParams(['search', 'category', 'type', 'status', 'sort'] as const, {
      status: 'active',
      sort: 'name',
    })
  const status = (filters.status as Status) || 'active'
  const canManage = can(user.role, 'products.manage')
  const showCosts = canSeeCosts(user.role)

  const params: ProductListParams = {
    page,
    page_size: pageSize,
    ordering: (filters.sort as Sort) || 'name',
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.category ? { category: Number(filters.category) } : {}),
    ...(filters.type ? { product_type: filters.type as ProductType } : {}),
    ...(status !== 'all' ? { is_active: status === 'active' } : {}),
  }
  const query = useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => fetchProductPage(params),
    placeholderData: keepPreviousData,
  })
  const categories = useQuery({
    queryKey: categoryKeys.options,
    queryFn: fetchCategoryOptions,
    staleTime: 60_000,
  })

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [toDeactivate, setToDeactivate] = useState<Product | null>(null)

  const afterChange = () => {
    void queryClient.invalidateQueries({ queryKey: productKeys.all })
    void queryClient.invalidateQueries({ queryKey: categoryKeys.all })
  }
  const deactivate = useMutation({
    mutationFn: (product: Product) => deactivateProduct(product.id),
    onSuccess: (_data, product) => {
      toast.success(t('products.deactivated', { name: product.name }))
      afterChange()
      setToDeactivate(null)
    },
    meta: { silentError: true },
  })
  const reactivate = useMutation({
    mutationFn: (product: Product) => updateProduct(product.id, { is_active: true }),
    onSuccess: (_data, product) => {
      toast.success(t('products.reactivated', { name: product.name }))
      afterChange()
    },
  })

  const branchName = new Map(branches.map((b) => [b.id, b.name]))
  /** "Not sold at Remera" badge for branches the viewer can see. */
  function hiddenBadge(product: Product) {
    const names = product.hidden_branch_ids.map((id) => branchName.get(id)).filter(Boolean)
    if (names.length === 0) return null
    return (
      <Badge tone="warning" title={names.join(', ')}>
        <EyeOff className="size-3" aria-hidden="true" />
        {names.length === 1
          ? t('products.notSoldAt', { branch: names[0] })
          : t('products.notSoldAtCount', { count: names.length })}
      </Badge>
    )
  }
  const statusBadge = (product: Product) =>
    product.is_active ? null : (
      <Badge tone="neutral" dot>
        {t('list.statusInactive')}
      </Badge>
    )
  const price = (product: Product) =>
    product.current_price === null ? (
      <span className="text-ink-subtle">{t('products.noPrice')}</span>
    ) : (
      format.money(product.current_price)
    )
  const margin = (product: Product) => {
    const ratio = marginRatio(product.current_price, product.current_cost_price)
    return ratio === null ? '—' : format.percent(ratio * 100)
  }

  /** Icon-only in table rows (tooltips + accessible names), labelled in phone cards. */
  function actions(product: Product, compact = false) {
    if (!canManage) return null
    const size = compact ? 'icon' : 'sm'
    const label = (key: 'editLabel' | 'deactivateLabel' | 'reactivateLabel') =>
      t(`products.${key}`, { name: product.name })
    return (
      <div
        className={cn('flex items-center justify-end gap-1', compact ? 'flex-nowrap' : 'flex-wrap')}
      >
        <Button
          variant="ghost"
          size={size}
          onClick={() => setEditing(product)}
          aria-label={label('editLabel')}
          title={compact ? label('editLabel') : undefined}
          leadingIcon={<Pencil className="size-4" aria-hidden="true" />}
        >
          {compact ? null : t('products.edit')}
        </Button>
        {product.is_active ? (
          <Button
            variant="ghost"
            size={size}
            onClick={() => setToDeactivate(product)}
            aria-label={label('deactivateLabel')}
            title={compact ? label('deactivateLabel') : undefined}
            leadingIcon={<PowerOff className="size-4" aria-hidden="true" />}
          >
            {compact ? null : t('products.deactivate')}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size={size}
            loading={reactivate.isPending && reactivate.variables?.id === product.id}
            onClick={() => reactivate.mutate(product)}
            aria-label={label('reactivateLabel')}
            title={compact ? label('reactivateLabel') : undefined}
            leadingIcon={<Power className="size-4" aria-hidden="true" />}
          >
            {compact ? null : t('products.reactivate')}
          </Button>
        )}
      </div>
    )
  }

  const data = query.data
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CatalogTabs />
        {canManage && (
          <Button
            onClick={() => setCreating(true)}
            leadingIcon={<Plus className="size-4" aria-hidden="true" />}
          >
            {t('products.add')}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <SearchInput
          className="md:max-w-md"
          label={t('products.search')}
          value={filters.search}
          onChange={(v) => setFilter('search', v)}
        />
        <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end">
          <SelectField
            label={t('products.category')}
            className="md:w-48"
            value={filters.category}
            onChange={(e) => setFilter('category', e.target.value)}
          >
            <option value="">{t('products.allCategories')}</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.is_active ? c.name : t('products.categoryInactive', { name: c.name })}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t('products.type')}
            className="md:w-48"
            value={filters.type}
            onChange={(e) => setFilter('type', e.target.value)}
          >
            <option value="">{t('products.allTypes')}</option>
            {PRODUCT_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`products.types.${value}`)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t('products.sortBy')}
            className="col-span-2 md:w-48"
            value={filters.sort || 'name'}
            onChange={(e) => setFilter('sort', e.target.value)}
          >
            {SORTS.map((value) => (
              <option key={value} value={value}>
                {t(`products.sort.${value}`)}
              </option>
            ))}
          </SelectField>
          <Segmented
            className="col-span-2 md:col-span-1"
            label={t('list.status')}
            value={status}
            onChange={(v) => setFilter('status', v)}
            options={[
              { value: 'active', label: t('list.statusActive') },
              { value: 'inactive', label: t('list.statusInactive') },
              { value: 'all', label: t('list.statusAll') },
            ]}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        ) : data && data.results.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              icon={Coffee}
              title={t('list.noMatchTitle')}
              description={t('list.noMatchBody')}
            />
          ) : (
            <EmptyState
              icon={Coffee}
              title={t('products.emptyTitle')}
              description={canManage ? t('products.emptyBody') : t('products.emptyBodyReadOnly')}
            />
          )
        ) : (
          data &&
          (isDesktop ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t('products.product')}</Th>
                  <Th>{t('products.category')}</Th>
                  <Th className="hidden xl:table-cell">{t('products.type')}</Th>
                  <Th className="text-right">{t('products.price')}</Th>
                  {showCosts && (
                    <Th className="hidden text-right xl:table-cell">{t('products.margin')}</Th>
                  )}
                  {canManage && (
                    <Th className="text-right">
                      <span className="sr-only">{t('list.actions')}</span>
                    </Th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.results.map((product) => (
                  <tr key={product.id} className="hover:bg-surface-muted/60">
                    <Td>
                      <ProductName product={product}>
                        {statusBadge(product)}
                        {hiddenBadge(product)}
                      </ProductName>
                    </Td>
                    <Td className="text-ink-muted">{product.category_name ?? '—'}</Td>
                    <Td className="hidden text-ink-muted xl:table-cell">
                      {t(`products.types.${product.product_type}`)}
                    </Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">{price(product)}</Td>
                    {showCosts && (
                      <Td className="hidden text-right text-ink-muted tabular-nums xl:table-cell">
                        {margin(product)}
                      </Td>
                    )}
                    {canManage && <Td>{actions(product, true)}</Td>}
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <ul className="divide-y divide-border">
              {data.results.map((product) => (
                <li key={product.id} className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <ProductName product={product} />
                    <p className="shrink-0 font-semibold whitespace-nowrap text-ink tabular-nums">
                      {price(product)}
                    </p>
                  </div>
                  <p className="text-sm text-ink-muted">
                    {[product.category_name, t(`products.types.${product.product_type}`)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {(!product.is_active || product.hidden_branch_ids.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {statusBadge(product)}
                      {hiddenBadge(product)}
                    </div>
                  )}
                  {canManage && <div className="-mr-2">{actions(product)}</div>}
                </li>
              ))}
            </ul>
          ))
        )}
      </Card>

      {data && data.count > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          count={data.count}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}

      <ProductFormDialog
        open={creating || editing !== null}
        product={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
      />
      <ConfirmDialog
        open={toDeactivate !== null}
        onClose={() => {
          setToDeactivate(null)
          deactivate.reset()
        }}
        onConfirm={() => toDeactivate && deactivate.mutate(toDeactivate)}
        title={t('products.deactivateTitle', { name: toDeactivate?.name ?? '' })}
        confirmLabel={t('products.deactivate')}
        pending={deactivate.isPending}
        error={deactivate.error ? getErrorMessage(deactivate.error) : null}
      >
        <p>{t('products.deactivateBody')}</p>
      </ConfirmDialog>
    </div>
  )
}
