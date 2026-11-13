import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ReceiptText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ListError, ListSkeleton } from '@/components/feedback/ListStates'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { SelectField } from '@/components/ui/SelectField'
import { Table, Td, Th } from '@/components/ui/Table'
import { TextField } from '@/components/ui/TextField'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useBusiness } from '@/features/business/useBusiness'
import { useListParams } from '@/hooks/useListParams'
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery'

import { fetchSalePage, saleKeys, type Sale, type SaleListParams } from './api'
import { SaleStateBadge } from './SaleStateBadge'

const STATUSES = ['completed', 'refunded', 'cancelled'] as const

const itemCount = (sale: Sale) =>
  sale.items.reduce((n, i) => n + Number(i.quantity), 0).toLocaleString()
const number = (sale: Sale) => (
  <Link
    to={`/sales/${sale.id}`}
    className="font-medium text-ink tabular-nums hover:text-primary hover:underline"
  >
    {sale.transaction_number}
  </Link>
)

/** Transaction history (POS-017). Cashiers see only their own sales (the API scopes it). */
export function SalesPage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { branchId, format } = useBusiness()
  const isDesktop = useMediaQuery(MD_UP)
  const { filters, setFilter, hasActiveFilters, page, pageSize, setPage, setPageSize } =
    useListParams(['search', 'status', 'from', 'to'] as const)

  const params: SaleListParams = {
    page,
    page_size: pageSize,
    ...(branchId ? { branch: branchId } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.status ? { status: filters.status as (typeof STATUSES)[number] } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  }
  const query = useQuery({
    queryKey: saleKeys.list(params),
    queryFn: () => fetchSalePage(params),
    placeholderData: keepPreviousData,
  })

  const showBranch = branchId === null

  const data = query.data
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {user.role === 'cashier' && <p className="text-sm text-ink-muted">{t('sales.ownOnly')}</p>}
      <div className="flex flex-col gap-3">
        <SearchInput
          className="md:max-w-md"
          label={t('sales.search')}
          value={filters.search}
          onChange={(v) => setFilter('search', v)}
        />
        <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end">
          <SelectField
            label={t('list.status')}
            className="col-span-2 md:w-48"
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
          >
            <option value="">{t('sales.allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`sales.status.${s}`)}
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
      </div>

      <Card className="overflow-hidden">
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        ) : data && data.results.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={hasActiveFilters ? t('list.noMatchTitle') : t('sales.emptyTitle')}
            description={hasActiveFilters ? t('list.noMatchBody') : t('sales.emptyBody')}
          />
        ) : (
          data &&
          (isDesktop ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t('sales.transaction')}</Th>
                  <Th>{t('sales.when')}</Th>
                  {showBranch && <Th className="hidden lg:table-cell">{t('sales.branch')}</Th>}
                  <Th className="hidden lg:table-cell">{t('sales.cashier')}</Th>
                  <Th className="text-right">{t('sales.items')}</Th>
                  <Th className="text-right">{t('sales.total')}</Th>
                  <Th>{t('list.status')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((sale) => (
                  <tr key={sale.id} className="hover:bg-surface-muted/60">
                    <Td>{number(sale)}</Td>
                    <Td className="whitespace-nowrap text-ink-muted">
                      {format.dateTime(sale.created_at)}
                    </Td>
                    {showBranch && (
                      <Td className="hidden text-ink-muted lg:table-cell">{sale.branch_name}</Td>
                    )}
                    <Td className="hidden text-ink-muted lg:table-cell">{sale.cashier_name}</Td>
                    <Td className="text-right tabular-nums">{itemCount(sale)}</Td>
                    <Td className="text-right font-medium whitespace-nowrap tabular-nums">
                      {format.money(sale.total_amount, { currency: sale.currency_code })}
                    </Td>
                    <Td>
                      <SaleStateBadge sale={sale} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <ul className="divide-y divide-border">
              {data.results.map((sale) => (
                <li key={sale.id} className="flex flex-col gap-1.5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    {number(sale)}
                    <span className="font-semibold whitespace-nowrap tabular-nums">
                      {format.money(sale.total_amount, { currency: sale.currency_code })}
                    </span>
                  </div>
                  <p className="text-sm text-ink-muted">
                    {[
                      format.dateTime(sale.created_at),
                      showBranch ? sale.branch_name : null,
                      sale.cashier_name,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <div>
                    <SaleStateBadge sale={sale} />
                  </div>
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
