import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Boxes, History, Minus, Plus, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ListError, ListSkeleton } from '@/components/feedback/ListStates'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Segmented } from '@/components/ui/Segmented'
import { SelectField } from '@/components/ui/SelectField'
import { Table, Td, Th } from '@/components/ui/Table'
import { can, canSeeCosts } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useBusiness } from '@/features/business/useBusiness'
import type { ProductType } from '@/features/products/api'
import { ProductThumb } from '@/features/products/ProductThumb'
import { useListParams } from '@/hooks/useListParams'
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'

import {
  fetchStockPage,
  fetchStockSummary,
  stockKeys,
  type StockListParams,
  type StockRow,
} from './api'
import { InventoryTabs } from './InventoryTabs'
import { StockMoveDialog } from './StockMoveDialog'
import { ThresholdDialog } from './ThresholdDialog'
import { useQuantity } from './useQuantity'

type Level = 'all' | 'low' | 'out'
type Sort = NonNullable<StockListParams['ordering']>
const SORTS: readonly Sort[] = ['name', 'quantity', '-quantity']

function levelOf(row: StockRow): 'out' | 'low' | 'ok' {
  if (Number(row.quantity) <= 0) return 'out'
  return row.is_low_stock ? 'low' : 'ok'
}

/** Stock by branch (INV-001, INV-002, INV-009, INV-012, INV-013). */
export function StockPage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { branchId, format } = useBusiness()
  const quantity = useQuantity()
  const isDesktop = useMediaQuery(MD_UP)
  const canManage = can(user.role, 'inventory.manage')
  const showCosts = canSeeCosts(user.role)
  const { filters, setFilter, hasActiveFilters, page, pageSize, setPage, setPageSize } =
    useListParams(['search', 'level', 'sort'] as const, { level: 'all', sort: 'name' })
  const level = (filters.level as Level) || 'all'

  const params: StockListParams = {
    page,
    page_size: pageSize,
    ordering: (filters.sort as Sort) || 'name',
    ...(branchId ? { branch: branchId } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    ...(level !== 'all' ? { level } : {}),
  }
  const query = useQuery({
    queryKey: stockKeys.list(params),
    queryFn: () => fetchStockPage(params),
    placeholderData: keepPreviousData,
  })
  const summary = useQuery({
    queryKey: stockKeys.summary(branchId),
    queryFn: () => fetchStockSummary(branchId),
  })

  const [receiving, setReceiving] = useState<StockRow | 'new' | null>(null)
  const [removing, setRemoving] = useState<StockRow | null>(null)
  const [thresholdRow, setThresholdRow] = useState<StockRow | null>(null)

  const levelBadge = (row: StockRow) => {
    const state = levelOf(row)
    return (
      <Badge tone={state === 'out' ? 'danger' : state === 'low' ? 'warning' : 'success'} dot>
        {t(`stock.level.${state}`)}
      </Badge>
    )
  }
  const productCell = (row: StockRow) => (
    <div className="flex min-w-0 items-center gap-3">
      <ProductThumb
        image={row.product_image}
        type={row.product_type as ProductType}
        className="size-10"
      />
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{row.product_name}</p>
        <p className="truncate text-xs text-ink-muted">
          {[row.product_sku, branchId === null ? row.branch_name : null]
            .filter(Boolean)
            .join(' · ')}
          {!row.product_is_active && ` · ${t('stock.productInactive')}`}
        </p>
      </div>
    </div>
  )

  function actions(row: StockRow, compact = false) {
    const size = compact ? 'icon' : 'sm'
    const label = (key: 'receiveLabel' | 'removeLabel' | 'minimumLabel' | 'historyLabel') =>
      t(`stock.${key}`, { name: row.product_name })
    return (
      <div
        className={cn('flex items-center justify-end gap-1', compact ? 'flex-nowrap' : 'flex-wrap')}
      >
        {canManage && (
          <>
            <Button
              variant="ghost"
              size={size}
              onClick={() => setReceiving(row)}
              aria-label={label('receiveLabel')}
              title={compact ? label('receiveLabel') : undefined}
              leadingIcon={<Plus className="size-4" aria-hidden="true" />}
            >
              {compact ? null : t('stock.receive')}
            </Button>
            <Button
              variant="ghost"
              size={size}
              onClick={() => setRemoving(row)}
              disabled={Number(row.quantity) <= 0}
              aria-label={label('removeLabel')}
              title={compact ? label('removeLabel') : undefined}
              leadingIcon={<Minus className="size-4" aria-hidden="true" />}
            >
              {compact ? null : t('stock.remove')}
            </Button>
            <Button
              variant="ghost"
              size={size}
              onClick={() => setThresholdRow(row)}
              aria-label={label('minimumLabel')}
              title={compact ? label('minimumLabel') : undefined}
              leadingIcon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
            >
              {compact ? null : t('stock.minimum')}
            </Button>
          </>
        )}
        <Link
          to={`/inventory/movements?product=${row.product}${branchId ? '' : `&branch=${row.branch}`}`}
          aria-label={label('historyLabel')}
          title={label('historyLabel')}
          className="grid size-11 place-items-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <History className="size-4" aria-hidden="true" />
        </Link>
      </div>
    )
  }

  const s = summary.data
  const tiles = [
    {
      key: 'tracked',
      label: t('stock.tracked'),
      value: s ? format.number(s.tracked_products) : '—',
    },
    {
      key: 'low',
      label: t('stock.lowCount'),
      value: s ? format.number(s.low_stock) : '—',
      tone: s && s.low_stock > 0 ? 'text-warning' : undefined,
    },
    {
      key: 'out',
      label: t('stock.outCount'),
      value: s ? format.number(s.out_of_stock) : '—',
      tone: s && s.out_of_stock > 0 ? 'text-danger' : undefined,
    },
    ...(showCosts
      ? [{ key: 'value', label: t('stock.value'), value: s ? format.money(s.total_value) : '—' }]
      : []),
  ]

  const data = query.data
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <InventoryTabs />
        {canManage && (
          <Button
            onClick={() => setReceiving('new')}
            leadingIcon={<Plus className="size-4" aria-hidden="true" />}
          >
            {t('stock.receiveStock')}
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.key} className="p-4">
            <dt className="text-sm text-ink-muted">{tile.label}</dt>
            <dd
              className={cn(
                'mt-1 text-xl font-semibold text-ink tabular-nums sm:text-2xl',
                tile.tone,
              )}
            >
              {tile.value}
            </dd>
          </Card>
        ))}
      </dl>
      {showCosts && <p className="-mt-2 text-xs text-ink-muted">{t('stock.valuationNote')}</p>}

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <SearchInput
          className="md:max-w-sm md:flex-1"
          label={t('stock.search')}
          value={filters.search}
          onChange={(v) => setFilter('search', v)}
        />
        <Segmented
          label={t('stock.levelFilter')}
          value={level}
          onChange={(v) => setFilter('level', v)}
          options={[
            { value: 'all', label: t('list.statusAll') },
            { value: 'low', label: t('stock.level.low') },
            { value: 'out', label: t('stock.level.out') },
          ]}
        />
        <SelectField
          label={t('products.sortBy')}
          className="md:w-52"
          value={filters.sort || 'name'}
          onChange={(e) => setFilter('sort', e.target.value)}
        >
          {SORTS.map((value) => (
            <option key={value} value={value}>
              {t(`stock.sort.${value}`)}
            </option>
          ))}
        </SelectField>
      </div>

      <Card className="overflow-hidden">
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        ) : data && data.results.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={hasActiveFilters ? t('list.noMatchTitle') : t('stock.emptyTitle')}
            description={hasActiveFilters ? t('list.noMatchBody') : t('stock.emptyBody')}
          />
        ) : (
          data &&
          (isDesktop ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t('stock.product')}</Th>
                  <Th className="text-right">{t('stock.onHand')}</Th>
                  <Th className="hidden text-right lg:table-cell">{t('stock.minimum')}</Th>
                  <Th>{t('list.status')}</Th>
                  {showCosts && (
                    <Th className="hidden text-right xl:table-cell">{t('stock.value')}</Th>
                  )}
                  <Th className="text-right">
                    <span className="sr-only">{t('list.actions')}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-muted/60">
                    <Td>{productCell(row)}</Td>
                    <Td className="text-right font-medium whitespace-nowrap tabular-nums">
                      {quantity(row.quantity, row.product_unit)}
                    </Td>
                    <Td className="hidden text-right whitespace-nowrap text-ink-muted tabular-nums lg:table-cell">
                      {quantity(row.minimum_threshold, row.product_unit)}
                    </Td>
                    <Td>{levelBadge(row)}</Td>
                    {showCosts && (
                      <Td className="hidden text-right whitespace-nowrap text-ink-muted tabular-nums xl:table-cell">
                        {format.money(row.stock_value)}
                      </Td>
                    )}
                    <Td>{actions(row, true)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <ul className="divide-y divide-border">
              {data.results.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    {productCell(row)}
                    {levelBadge(row)}
                  </div>
                  <p className="text-sm text-ink-muted">
                    {t('stock.onHandLine', {
                      quantity: quantity(row.quantity, row.product_unit),
                      minimum: quantity(row.minimum_threshold, row.product_unit),
                    })}
                  </p>
                  <div className="-mr-2">{actions(row)}</div>
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

      {canManage && (
        <>
          <StockMoveDialog
            direction="in"
            open={receiving !== null}
            row={receiving === 'new' ? null : receiving}
            onClose={() => setReceiving(null)}
          />
          <StockMoveDialog
            direction="out"
            open={removing !== null}
            row={removing}
            onClose={() => setRemoving(null)}
          />
          <ThresholdDialog row={thresholdRow} onClose={() => setThresholdRow(null)} />
        </>
      )}
    </div>
  )
}
