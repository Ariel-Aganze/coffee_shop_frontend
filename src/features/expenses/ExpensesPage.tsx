import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Paperclip, Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ListError, ListSkeleton } from '@/components/feedback/ListStates'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Segmented } from '@/components/ui/Segmented'
import { SelectField } from '@/components/ui/SelectField'
import { Table, Td, Th } from '@/components/ui/Table'
import { TextField } from '@/components/ui/TextField'
import { can } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useBusiness } from '@/features/business/useBusiness'
import { useListParams } from '@/hooks/useListParams'
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'

import {
  expenseKeys,
  fetchCategoryOptions,
  fetchExpensePage,
  fetchExpenseSummary,
  type Expense,
  type ExpenseListParams,
  type ExpenseStatus,
} from './api'
import { ExpenseFormDialog } from './ExpenseFormDialog'
import { ExpenseStatusBadge, ExpenseTabs } from './parts'

type StatusFilter = 'all' | ExpenseStatus

const description = (e: Expense) => (
  <Link
    to={`/expenses/${e.id}`}
    className="line-clamp-2 font-medium text-ink hover:text-primary hover:underline"
  >
    {e.description}
  </Link>
)

/** Expenses (SRS 5.9): record, filter, review totals (EXP-002, EXP-008). */
export function ExpensesPage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { branchId, format } = useBusiness()
  const isDesktop = useMediaQuery(MD_UP)
  const canCreate = can(user.role, 'expenses.create')
  const canApprove = can(user.role, 'expenses.approve')
  const { filters, setFilter, hasActiveFilters, page, pageSize, setPage, setPageSize } =
    useListParams(['search', 'status', 'category', 'from', 'to', 'mine'] as const, {
      // Approvers land on what needs their decision.
      status: canApprove ? 'pending' : 'all',
    })
  const status = (filters.status as StatusFilter) || 'all'

  const params: ExpenseListParams = {
    page,
    page_size: pageSize,
    ...(branchId ? { branch: branchId } : {}),
    ...(status !== 'all' ? { status } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.category ? { category: Number(filters.category) } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.mine === 'true' ? { mine: true } : {}),
  }
  const query = useQuery({
    queryKey: expenseKeys.list(params),
    queryFn: () => fetchExpensePage(params),
    placeholderData: keepPreviousData,
  })
  // Totals ignore the status filter: they show approved and pending side by side.
  const { status: _status, ...summaryParams } = params
  const summary = useQuery({
    queryKey: expenseKeys.summary(summaryParams),
    queryFn: () => fetchExpenseSummary(summaryParams),
    placeholderData: keepPreviousData,
  })
  const categories = useQuery({
    queryKey: expenseKeys.categoryOptions,
    queryFn: fetchCategoryOptions,
    staleTime: 60_000,
  })
  const [creating, setCreating] = useState(false)

  const s = summary.data
  const amount = (e: Expense) =>
    format.money(e.amount, { currency: e.currency_code, decimals: e.currency_decimal_places })
  const where = (e: Expense) => e.branch_name ?? t('expenses.wholeBusiness')

  const data = query.data
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ExpenseTabs />
        {canCreate && (
          <Button
            onClick={() => setCreating(true)}
            leadingIcon={<Plus className="size-4" aria-hidden="true" />}
          >
            {t('expenses.add')}
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <dt className="text-sm text-ink-muted">{t('expenses.approvedTotal')}</dt>
          <dd className="mt-1 text-xl font-semibold text-ink tabular-nums sm:text-2xl">
            {s ? format.money(s.approved_total) : '—'}
          </dd>
          <dd className="text-xs text-ink-muted">
            {s ? t('expenses.countLine', { count: s.approved_count }) : ''}
          </dd>
        </Card>
        <Card className="p-4">
          <dt className="text-sm text-ink-muted">{t('expenses.pendingTotal')}</dt>
          <dd
            className={cn(
              'mt-1 text-xl font-semibold tabular-nums sm:text-2xl',
              s && s.pending_count > 0 ? 'text-warning' : 'text-ink',
            )}
          >
            {s ? format.money(s.pending_total) : '—'}
          </dd>
          <dd className="text-xs text-ink-muted">
            {s ? t('expenses.countLine', { count: s.pending_count }) : ''}
          </dd>
        </Card>
      </dl>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SearchInput
            className="md:max-w-sm md:flex-1"
            label={t('expenses.search')}
            value={filters.search}
            onChange={(v) => setFilter('search', v)}
          />
          <Segmented
            label={t('list.status')}
            value={status}
            onChange={(v) => setFilter('status', v)}
            options={[
              { value: 'all', label: t('list.statusAll') },
              { value: 'pending', label: t('expenses.status.pending') },
              { value: 'approved', label: t('expenses.status.approved') },
              { value: 'rejected', label: t('expenses.status.rejected') },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end">
          <SelectField
            label={t('expenses.category')}
            className="col-span-2 md:w-52"
            value={filters.category}
            onChange={(e) => setFilter('category', e.target.value)}
          >
            <option value="">{t('products.allCategories')}</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
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
          {canCreate && (
            <label className="col-span-2 flex h-11 items-center gap-2 text-sm text-ink md:col-span-1">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={filters.mine === 'true'}
                onChange={(e) => setFilter('mine', e.target.checked ? 'true' : '')}
              />
              {t('expenses.mine')}
            </label>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        ) : data && data.results.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={
              hasActiveFilters || status !== 'all'
                ? status === 'pending' && !hasActiveFilters
                  ? t('expenses.nothingPending')
                  : t('list.noMatchTitle')
                : t('expenses.emptyTitle')
            }
            description={
              hasActiveFilters || status !== 'all' ? t('list.noMatchBody') : t('expenses.emptyBody')
            }
          />
        ) : (
          data &&
          (isDesktop ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t('expenses.date')}</Th>
                  <Th>{t('expenses.description')}</Th>
                  <Th className="hidden lg:table-cell">{t('expenses.branch')}</Th>
                  <Th className="text-right">{t('expenses.amount')}</Th>
                  <Th>{t('list.status')}</Th>
                  <Th className="hidden xl:table-cell">{t('expenses.filedBy')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-muted/60">
                    <Td className="whitespace-nowrap text-ink-muted">
                      {format.date(e.expense_date)}
                    </Td>
                    <Td>
                      {description(e)}
                      <p className="flex items-center gap-1 text-xs text-ink-muted">
                        {e.category_name}
                        {e.attachment && (
                          <>
                            <Paperclip className="size-3" aria-hidden="true" />
                            <span className="sr-only">{t('expenses.hasReceipt')}</span>
                          </>
                        )}
                      </p>
                    </Td>
                    <Td className="hidden text-ink-muted lg:table-cell">{where(e)}</Td>
                    <Td className="text-right font-medium whitespace-nowrap tabular-nums">
                      {amount(e)}
                    </Td>
                    <Td>
                      <ExpenseStatusBadge status={e.status} />
                    </Td>
                    <Td className="hidden text-ink-muted xl:table-cell">{e.submitted_by_name}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <ul className="divide-y divide-border">
              {data.results.map((e) => (
                <li key={e.id} className="flex flex-col gap-1.5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    {description(e)}
                    <span className="font-semibold whitespace-nowrap tabular-nums">
                      {amount(e)}
                    </span>
                  </div>
                  <p className="text-sm text-ink-muted">
                    {[format.date(e.expense_date), e.category_name, where(e)].join(' · ')}
                  </p>
                  <div>
                    <ExpenseStatusBadge status={e.status} />
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

      {canCreate && <ExpenseFormDialog open={creating} onClose={() => setCreating(false)} />}
    </div>
  )
}
