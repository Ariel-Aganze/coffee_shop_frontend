import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, MapPin, Pencil, Phone, Plus, Power, PowerOff, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { can } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useListParams } from '@/hooks/useListParams'
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import { getErrorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/cn'

import {
  branchKeys,
  deactivateBranch,
  fetchBranchPage,
  invalidateBranches,
  updateBranch,
  type Branch,
} from './api'
import { BranchFormDialog } from './BranchFormDialog'

type Status = 'active' | 'inactive' | 'all'
const STATUS_PARAM: Record<Status, boolean | undefined> = {
  active: true,
  inactive: false,
  all: undefined,
}

/** Branches (SRS 5.2): list, search, add, edit, deactivate / reactivate. */
export function BranchesPage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery(MD_UP)
  const { filters, setFilter, hasActiveFilters, page, pageSize, setPage, setPageSize } =
    useListParams(['search', 'status'] as const, { status: 'active' })
  const status = (filters.status as Status) || 'active'

  const params = {
    page,
    page_size: pageSize,
    ...(filters.search ? { search: filters.search } : {}),
    ...(STATUS_PARAM[status] !== undefined ? { is_active: STATUS_PARAM[status] } : {}),
  }
  const query = useQuery({
    queryKey: branchKeys.list(params),
    queryFn: () => fetchBranchPage(params),
    placeholderData: keepPreviousData,
  })

  const [editing, setEditing] = useState<Branch | null>(null)
  const [creating, setCreating] = useState(false)
  const [toDeactivate, setToDeactivate] = useState<Branch | null>(null)

  const deactivate = useMutation({
    mutationFn: (branch: Branch) => deactivateBranch(branch.id),
    onSuccess: (_data, branch) => {
      toast.success(t('branches.deactivated', { name: branch.name }))
      invalidateBranches(queryClient)
      setToDeactivate(null)
    },
    meta: { silentError: true }, // shown inside the dialog
  })
  const reactivate = useMutation({
    mutationFn: (branch: Branch) => updateBranch(branch.id, { is_active: true }),
    onSuccess: (_data, branch) => {
      toast.success(t('branches.reactivated', { name: branch.name }))
      invalidateBranches(queryClient)
    },
  })

  const canCreate = can(user.role, 'branches.create')
  const canEdit = can(user.role, 'branches.edit')
  const canDeactivate = can(user.role, 'branches.deactivate')

  /** Icon-only in table rows (tooltips + accessible names), labelled in phone cards. */
  function actions(branch: Branch, compact = false) {
    return (
      <div
        className={cn('flex items-center justify-end gap-1', compact ? 'flex-nowrap' : 'flex-wrap')}
      >
        {canEdit && (
          <Button
            variant="ghost"
            size={compact ? 'icon' : 'sm'}
            onClick={() => setEditing(branch)}
            aria-label={t('branches.editLabel', { name: branch.name })}
            title={compact ? t('branches.editLabel', { name: branch.name }) : undefined}
            leadingIcon={<Pencil className="size-4" aria-hidden="true" />}
          >
            {compact ? null : t('branches.edit')}
          </Button>
        )}
        {canDeactivate &&
          (branch.is_active ? (
            <Button
              variant="ghost"
              size={compact ? 'icon' : 'sm'}
              onClick={() => setToDeactivate(branch)}
              aria-label={t('branches.deactivateLabel', { name: branch.name })}
              title={compact ? t('branches.deactivateLabel', { name: branch.name }) : undefined}
              leadingIcon={<PowerOff className="size-4" aria-hidden="true" />}
            >
              {compact ? null : t('branches.deactivate')}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size={compact ? 'icon' : 'sm'}
              loading={reactivate.isPending && reactivate.variables?.id === branch.id}
              onClick={() => reactivate.mutate(branch)}
              aria-label={t('branches.reactivateLabel', { name: branch.name })}
              title={compact ? t('branches.reactivateLabel', { name: branch.name }) : undefined}
              leadingIcon={<Power className="size-4" aria-hidden="true" />}
            >
              {compact ? null : t('branches.reactivate')}
            </Button>
          ))}
      </div>
    )
  }

  const managersText = (branch: Branch) =>
    branch.managers.map((m) => m.name).join(', ') || t('branches.noManager')
  const statusBadge = (branch: Branch) =>
    branch.is_active ? (
      <Badge tone="success" dot>
        {t('list.statusActive')}
      </Badge>
    ) : (
      <Badge tone="neutral" dot>
        {t('list.statusInactive')}
      </Badge>
    )

  const data = query.data
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput
          className="md:max-w-sm md:flex-1"
          label={t('branches.search')}
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
        {canCreate && (
          <Button
            className="md:ml-auto"
            onClick={() => setCreating(true)}
            leadingIcon={<Plus className="size-4" aria-hidden="true" />}
          >
            {t('branches.add')}
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        ) : data && data.results.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              icon={Building2}
              title={t('list.noMatchTitle')}
              description={t('list.noMatchBody')}
            />
          ) : (
            <EmptyState
              icon={Building2}
              title={t('branches.emptyTitle')}
              description={t('branches.emptyBody')}
            />
          )
        ) : (
          data && (
            <>
              {/* One layout per screen size: table from tablet up, cards on phones. */}
              {isDesktop ? (
                <div>
                  <Table>
                    <thead>
                      <tr>
                        <Th>{t('branches.name')}</Th>
                        <Th>{t('branches.phone')}</Th>
                        <Th>{t('branches.managers')}</Th>
                        <Th>{t('branches.staff')}</Th>
                        <Th>{t('list.status')}</Th>
                        {(canEdit || canDeactivate) && (
                          <Th className="text-right">
                            <span className="sr-only">{t('list.actions')}</span>
                          </Th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data.results.map((branch) => (
                        <tr key={branch.id} className="hover:bg-surface-muted/60">
                          <Td>
                            <p className="font-medium">{branch.name}</p>
                            {branch.address && (
                              <p className="max-w-xs truncate text-xs text-ink-muted">
                                {branch.address}
                              </p>
                            )}
                          </Td>
                          <Td className="whitespace-nowrap text-ink-muted">
                            {branch.phone || '—'}
                          </Td>
                          <Td className="text-ink-muted">{managersText(branch)}</Td>
                          <Td className="whitespace-nowrap">
                            {t('branches.staffCount', { count: branch.staff_count })}
                          </Td>
                          <Td>{statusBadge(branch)}</Td>
                          {(canEdit || canDeactivate) && <Td>{actions(branch, true)}</Td>}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {data.results.map((branch) => (
                    <li key={branch.id} className="flex flex-col gap-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-ink">{branch.name}</p>
                        {statusBadge(branch)}
                      </div>
                      <dl className="flex flex-col gap-1 text-sm text-ink-muted">
                        {branch.address && (
                          <div className="flex items-start gap-2">
                            <dt className="sr-only">{t('branches.address')}</dt>
                            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            <dd>{branch.address}</dd>
                          </div>
                        )}
                        {branch.phone && (
                          <div className="flex items-center gap-2">
                            <dt className="sr-only">{t('branches.phone')}</dt>
                            <Phone className="size-4 shrink-0" aria-hidden="true" />
                            <dd>{branch.phone}</dd>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <dt className="sr-only">{t('branches.staff')}</dt>
                          <Users className="size-4 shrink-0" aria-hidden="true" />
                          <dd>
                            {t('branches.staffCount', { count: branch.staff_count })} ·{' '}
                            {managersText(branch)}
                          </dd>
                        </div>
                      </dl>
                      {(canEdit || canDeactivate) && <div className="-mr-2">{actions(branch)}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
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

      <BranchFormDialog
        open={creating || editing !== null}
        branch={editing}
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
        title={t('branches.deactivateTitle', { name: toDeactivate?.name ?? '' })}
        confirmLabel={t('branches.deactivateConfirm')}
        pending={deactivate.isPending}
        error={deactivate.error ? getErrorMessage(deactivate.error) : null}
      >
        <p>{t('branches.deactivateBody')}</p>
      </ConfirmDialog>
    </div>
  )
}
