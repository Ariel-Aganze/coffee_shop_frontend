import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Power, PowerOff, Tags } from 'lucide-react'
import { useState } from 'react'
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
import { Table, Td, Th } from '@/components/ui/Table'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useListParams } from '@/hooks/useListParams'
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import { getErrorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/cn'

import {
  deactivateCategory,
  expenseKeys,
  fetchCategoryPage,
  invalidateExpenses,
  updateCategory,
  type ExpenseCategory as Category,
  type ExpenseCategoryListParams as CategoryListParams,
} from './api'
import { ExpenseCategoryDialog } from './ExpenseCategoryDialog'
import { ExpenseTabs } from './parts'

type Status = 'active' | 'inactive' | 'all'

/** Expense categories (EXP-001): rent, utilities, supplies… Only the owner manages them. */
export function ExpenseCategoriesPage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery(MD_UP)
  const { filters, setFilter, hasActiveFilters, page, pageSize, setPage, setPageSize } =
    useListParams(['search', 'status'] as const, { status: 'active' })
  const status = (filters.status as Status) || 'active'
  const canManage = user.role === 'owner'

  const params: CategoryListParams = {
    page,
    page_size: pageSize,
    ...(filters.search ? { search: filters.search } : {}),
    ...(status !== 'all' ? { is_active: status === 'active' } : {}),
  }
  const query = useQuery({
    queryKey: expenseKeys.categories(params),
    queryFn: () => fetchCategoryPage(params),
    placeholderData: keepPreviousData,
  })

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [toDeactivate, setToDeactivate] = useState<Category | null>(null)

  const deactivate = useMutation({
    mutationFn: (category: Category) => deactivateCategory(category.id),
    onSuccess: (_data, category) => {
      toast.success(t('categories.deactivated', { name: category.name }))
      invalidateExpenses(queryClient)
      setToDeactivate(null)
    },
    meta: { silentError: true },
  })
  const reactivate = useMutation({
    mutationFn: (category: Category) => updateCategory(category.id, { is_active: true }),
    onSuccess: (_data, category) => {
      toast.success(t('categories.reactivated', { name: category.name }))
      invalidateExpenses(queryClient)
    },
  })

  const expensesLink = (category: Category) => (
    <Link
      to={`/expenses?category=${category.id}&status=all`}
      className="whitespace-nowrap text-primary hover:underline"
    >
      {t('expenseCategories.count', { count: category.expense_count })}
    </Link>
  )
  const statusBadge = (category: Category) =>
    category.is_active ? (
      <Badge tone="success" dot>
        {t('list.statusActive')}
      </Badge>
    ) : (
      <Badge tone="neutral" dot>
        {t('list.statusInactive')}
      </Badge>
    )

  function actions(category: Category, compact = false) {
    if (!canManage) return null
    const size = compact ? 'icon' : 'sm'
    const label = (key: 'editLabel' | 'deactivateLabel' | 'reactivateLabel') =>
      t(`categories.${key}`, { name: category.name })
    return (
      <div
        className={cn('flex items-center justify-end gap-1', compact ? 'flex-nowrap' : 'flex-wrap')}
      >
        <Button
          variant="ghost"
          size={size}
          onClick={() => setEditing(category)}
          aria-label={label('editLabel')}
          title={compact ? label('editLabel') : undefined}
          leadingIcon={<Pencil className="size-4" aria-hidden="true" />}
        >
          {compact ? null : t('categories.edit')}
        </Button>
        {category.is_active ? (
          <Button
            variant="ghost"
            size={size}
            onClick={() => setToDeactivate(category)}
            aria-label={label('deactivateLabel')}
            title={compact ? label('deactivateLabel') : undefined}
            leadingIcon={<PowerOff className="size-4" aria-hidden="true" />}
          >
            {compact ? null : t('categories.deactivate')}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size={size}
            loading={reactivate.isPending && reactivate.variables?.id === category.id}
            onClick={() => reactivate.mutate(category)}
            aria-label={label('reactivateLabel')}
            title={compact ? label('reactivateLabel') : undefined}
            leadingIcon={<Power className="size-4" aria-hidden="true" />}
          >
            {compact ? null : t('categories.reactivate')}
          </Button>
        )}
      </div>
    )
  }

  const data = query.data
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ExpenseTabs />
        {canManage && (
          <Button
            onClick={() => setCreating(true)}
            leadingIcon={<Plus className="size-4" aria-hidden="true" />}
          >
            {t('categories.add')}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput
          className="md:max-w-sm md:flex-1"
          label={t('categories.search')}
          value={filters.search}
          onChange={(v) => setFilter('search', v)}
        />
        <Segmented
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

      <Card className="overflow-hidden">
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        ) : data && data.results.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              icon={Tags}
              title={t('list.noMatchTitle')}
              description={t('list.noMatchBody')}
            />
          ) : (
            <EmptyState
              icon={Tags}
              title={t('categories.emptyTitle')}
              description={t('expenseCategories.emptyBody')}
            />
          )
        ) : (
          data &&
          (isDesktop ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t('categories.name')}</Th>
                  <Th>{t('expenseCategories.expenses')}</Th>
                  <Th>{t('list.status')}</Th>
                  {canManage && (
                    <Th className="text-right">
                      <span className="sr-only">{t('list.actions')}</span>
                    </Th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.results.map((category) => (
                  <tr key={category.id} className="hover:bg-surface-muted/60">
                    <Td>
                      <p className="font-medium">{category.name}</p>
                      {category.description && (
                        <p className="max-w-md truncate text-xs text-ink-muted">
                          {category.description}
                        </p>
                      )}
                    </Td>
                    <Td>{expensesLink(category)}</Td>
                    <Td>{statusBadge(category)}</Td>
                    {canManage && <Td>{actions(category, true)}</Td>}
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <ul className="divide-y divide-border">
              {data.results.map((category) => (
                <li key={category.id} className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-ink">{category.name}</p>
                    {statusBadge(category)}
                  </div>
                  {category.description && (
                    <p className="text-sm text-ink-muted">{category.description}</p>
                  )}
                  <p className="text-sm">{expensesLink(category)}</p>
                  {canManage && <div className="-mr-2">{actions(category)}</div>}
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

      <ExpenseCategoryDialog
        open={creating || editing !== null}
        category={editing}
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
        title={t('categories.deactivateTitle', { name: toDeactivate?.name ?? '' })}
        confirmLabel={t('categories.deactivate')}
        pending={deactivate.isPending}
        error={deactivate.error ? getErrorMessage(deactivate.error) : null}
      >
        <p>{t('expenseCategories.deactivateBody')}</p>
      </ConfirmDialog>
    </div>
  )
}
