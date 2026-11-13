import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { History, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ListError, ListSkeleton } from '@/components/feedback/ListStates'
import { Badge, type BadgeProps } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { SelectField } from '@/components/ui/SelectField'
import { Table, Td, Th } from '@/components/ui/Table'
import { TextField } from '@/components/ui/TextField'
import { useBusiness } from '@/features/business/useBusiness'
import { useListParams } from '@/hooks/useListParams'
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'

import {
  fetchMovementPage,
  MOVEMENT_TYPES,
  stockKeys,
  type Movement,
  type MovementListParams,
  type MovementType,
} from './api'
import { InventoryTabs } from './InventoryTabs'
import { useQuantity } from './useQuantity'

const TONES: Record<MovementType, NonNullable<BadgeProps['tone']>> = {
  purchase: 'success',
  return: 'success',
  transfer_in: 'info',
  sale: 'brand',
  transfer_out: 'info',
  adjustment: 'neutral',
  damaged: 'danger',
  expired: 'danger',
}

/** The stock ledger (INV-008, INV-015, INV-019): every change, who made it and why. */
export function MovementsPage() {
  const { t } = useTranslation()
  const { branchId, format } = useBusiness()
  const quantity = useQuantity()
  const isDesktop = useMediaQuery(MD_UP)
  const { filters, setFilter, hasActiveFilters, page, pageSize, setPage, setPageSize } =
    useListParams(['product', 'branch', 'type', 'from', 'to'] as const)

  const branch = filters.branch ? Number(filters.branch) : branchId
  const params: MovementListParams = {
    page,
    page_size: pageSize,
    ...(branch ? { branch } : {}),
    ...(filters.product ? { product: Number(filters.product) } : {}),
    ...(filters.type ? { type: filters.type as MovementType } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  }
  const query = useQuery({
    queryKey: stockKeys.movements(params),
    queryFn: () => fetchMovementPage(params),
    placeholderData: keepPreviousData,
  })

  const change = (m: Movement) => {
    const positive = Number(m.delta) > 0
    return (
      <span
        className={cn(
          'font-semibold whitespace-nowrap tabular-nums',
          positive ? 'text-success' : 'text-danger',
        )}
      >
        {positive ? '+' : '−'}
        {quantity(String(Math.abs(Number(m.delta))), m.product_unit)}
      </span>
    )
  }
  const details = (m: Movement) => (
    <>
      {m.reason && <span>{m.reason}</span>}
      {m.sale && m.sale_number && (
        <Link to={`/sales/${m.sale}`} className="text-primary hover:underline">
          {m.sale_number}
        </Link>
      )}
      {m.reference && !m.sale && <span>{t('stock.refLine', { reference: m.reference })}</span>}
    </>
  )
  const typeBadge = (m: Movement) => (
    <Badge tone={TONES[m.movement_type]}>{t(`stock.types.${m.movement_type}`)}</Badge>
  )
  const productName = query.data?.results[0]?.product_name

  const data = query.data
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <InventoryTabs />

      {filters.product && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-muted">{t('stock.showingProduct')}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-1 pr-1 pl-3 font-medium text-primary">
            {productName ?? `#${filters.product}`}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={t('stock.allProducts')}
              onClick={() => {
                setFilter('product', '')
                setFilter('branch', '')
              }}
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end">
        <SelectField
          label={t('stock.movementType')}
          className="col-span-2 md:w-52"
          value={filters.type}
          onChange={(e) => setFilter('type', e.target.value)}
        >
          <option value="">{t('stock.allTypes')}</option>
          {MOVEMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`stock.types.${type}`)}
            </option>
          ))}
        </SelectField>
        <TextField
          type="date"
          label={t('sales.from')}
          className="md:w-44"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(e) => setFilter('from', e.target.value)}
        />
        <TextField
          type="date"
          label={t('sales.to')}
          className="md:w-44"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(e) => setFilter('to', e.target.value)}
        />
      </div>

      <Card className="overflow-hidden">
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        ) : data && data.results.length === 0 ? (
          <EmptyState
            icon={History}
            title={hasActiveFilters ? t('list.noMatchTitle') : t('stock.noMovementsTitle')}
            description={hasActiveFilters ? t('list.noMatchBody') : t('stock.noMovementsBody')}
          />
        ) : (
          data &&
          (isDesktop ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t('sales.when')}</Th>
                  <Th>{t('stock.product')}</Th>
                  <Th>{t('stock.movementType')}</Th>
                  <Th className="text-right">{t('stock.change')}</Th>
                  <Th className="hidden text-right lg:table-cell">{t('stock.after')}</Th>
                  <Th className="hidden xl:table-cell">{t('stock.details')}</Th>
                  <Th className="hidden lg:table-cell">{t('stock.by')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((m) => (
                  <tr key={m.id}>
                    <Td className="whitespace-nowrap text-ink-muted">
                      {format.dateTime(m.created_at)}
                    </Td>
                    <Td>
                      <p className="font-medium text-ink">{m.product_name}</p>
                      {branch === null && <p className="text-xs text-ink-muted">{m.branch_name}</p>}
                    </Td>
                    <Td>{typeBadge(m)}</Td>
                    <Td className="text-right">{change(m)}</Td>
                    <Td className="hidden text-right whitespace-nowrap text-ink-muted tabular-nums lg:table-cell">
                      {quantity(m.quantity_after, m.product_unit)}
                    </Td>
                    <Td className="hidden max-w-xs text-sm text-ink-muted xl:table-cell">
                      <span className="flex flex-col">{details(m)}</span>
                    </Td>
                    <Td className="hidden text-ink-muted lg:table-cell">{m.performed_by_name}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <ul className="divide-y divide-border">
              {data.results.map((m) => (
                <li key={m.id} className="flex flex-col gap-1.5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-ink">{m.product_name}</p>
                    {change(m)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                    {typeBadge(m)}
                    <span>{format.dateTime(m.created_at)}</span>
                    <span>· {m.performed_by_name}</span>
                  </div>
                  <p className="flex flex-col text-sm text-ink-muted">{details(m)}</p>
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
    </div>
  )
}
