import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Lock, Mail, Pencil, Phone, Plus, Power, PowerOff, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ListError, ListSkeleton } from '@/components/feedback/ListStates'
import { Avatar } from '@/components/ui/Avatar'
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
import { assignableRoles, canManageUser, type Role } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/auth/useAuth'
import { invalidateBranches } from '@/features/branches/api'
import { useBusiness } from '@/features/business/useBusiness'
import { useListParams } from '@/hooks/useListParams'
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import { getErrorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/cn'
import { displayName } from '@/lib/names'

import {
  deactivateStaff,
  fetchStaffPage,
  staffKeys,
  updateStaff,
  type StaffListParams,
  type StaffMember,
} from './api'
import { SetPasswordDialog } from './SetPasswordDialog'
import { StaffFormDialog } from './StaffFormDialog'

const ALL_ROLES: Role[] = [
  'owner',
  'admin',
  'branch_manager',
  'cashier',
  'inventory_manager',
  'accountant',
]
type Status = 'active' | 'inactive' | 'all'

/** Employees (SRS 4, AUTH-005..009): list, search, add, edit, deactivate, set password. */
export function StaffPage() {
  const { t } = useTranslation()
  const actor = useCurrentUser()
  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery(MD_UP)
  const { branches, format } = useBusiness()
  const { filters, setFilter, hasActiveFilters, page, pageSize, setPage, setPageSize } =
    useListParams(['search', 'role', 'branch', 'status'] as const, { status: 'active' })
  const status = (filters.status as Status) || 'active'

  const params: StaffListParams = {
    page,
    page_size: pageSize,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.role ? { role: filters.role as Role } : {}),
    ...(filters.branch ? { branch: Number(filters.branch) } : {}),
    ...(status !== 'all' ? { is_active: status === 'active' } : {}),
  }
  const query = useQuery({
    queryKey: staffKeys.list(params),
    queryFn: () => fetchStaffPage(params),
    placeholderData: keepPreviousData,
  })

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [settingPassword, setSettingPassword] = useState<StaffMember | null>(null)
  const [toDeactivate, setToDeactivate] = useState<StaffMember | null>(null)

  const afterChange = () => {
    void queryClient.invalidateQueries({ queryKey: staffKeys.all })
    invalidateBranches(queryClient)
  }
  const deactivate = useMutation({
    mutationFn: (member: StaffMember) => deactivateStaff(member.id),
    onSuccess: (_data, member) => {
      toast.success(t('staff.deactivated', { name: displayName(member) }))
      afterChange()
      setToDeactivate(null)
    },
    meta: { silentError: true },
  })
  const reactivate = useMutation({
    mutationFn: (member: StaffMember) => updateStaff(member.id, { is_active: true }),
    onSuccess: (_data, member) => {
      toast.success(t('staff.reactivated', { name: displayName(member) }))
      afterChange()
    },
  })

  const branchName = new Map(branches.map((b) => [b.id, b.name]))
  const branchList = (member: StaffMember) =>
    member.branch_ids
      .map((id) => branchName.get(id))
      .filter(Boolean)
      .join(', ') ||
    (member.role === 'accountant' || member.role === 'owner' ? t('staff.allBranches') : '—')
  const roleOptions = actor.role === 'branch_manager' ? assignableRoles(actor) : ALL_ROLES

  /** Icon-only in table rows (tooltips + accessible names), labelled in phone cards. */
  function actions(member: StaffMember, compact = false) {
    if (!canManageUser(actor, member)) {
      return (
        <span className="flex items-center justify-end gap-1.5 text-xs text-ink-muted">
          <Lock className="size-3.5" aria-hidden="true" />
          {t('staff.readOnly')}
        </span>
      )
    }
    const name = displayName(member)
    return (
      <div
        className={cn('flex items-center justify-end gap-1', compact ? 'flex-nowrap' : 'flex-wrap')}
      >
        <Button
          variant="ghost"
          size={compact ? 'icon' : 'sm'}
          onClick={() => setEditing(member)}
          aria-label={t('staff.editLabel', { name })}
          title={compact ? t('staff.editLabel', { name }) : undefined}
          leadingIcon={<Pencil className="size-4" aria-hidden="true" />}
        >
          {compact ? null : t('staff.edit')}
        </Button>
        {member.is_active && (
          <Button
            variant="ghost"
            size={compact ? 'icon' : 'sm'}
            onClick={() => setSettingPassword(member)}
            aria-label={t('staff.setPasswordLabel', { name })}
            title={compact ? t('staff.setPasswordLabel', { name }) : undefined}
            leadingIcon={<KeyRound className="size-4" aria-hidden="true" />}
          >
            {compact ? null : t('staff.setPassword')}
          </Button>
        )}
        {member.is_active ? (
          <Button
            variant="ghost"
            size={compact ? 'icon' : 'sm'}
            onClick={() => setToDeactivate(member)}
            aria-label={t('staff.deactivateLabel', { name })}
            title={compact ? t('staff.deactivateLabel', { name }) : undefined}
            leadingIcon={<PowerOff className="size-4" aria-hidden="true" />}
          >
            {compact ? null : t('staff.deactivate')}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size={compact ? 'icon' : 'sm'}
            loading={reactivate.isPending && reactivate.variables?.id === member.id}
            onClick={() => reactivate.mutate(member)}
            aria-label={t('staff.reactivateLabel', { name })}
            title={compact ? t('staff.reactivateLabel', { name }) : undefined}
            leadingIcon={<Power className="size-4" aria-hidden="true" />}
          >
            {compact ? null : t('staff.reactivate')}
          </Button>
        )}
      </div>
    )
  }

  const lastActive = (member: StaffMember) =>
    member.last_login ? format.dateTime(member.last_login) : t('staff.never')
  const statusBadge = (member: StaffMember) =>
    member.is_active ? null : (
      <Badge tone="neutral" dot>
        {t('list.statusInactive')}
      </Badge>
    )

  const data = query.data
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SearchInput
            className="md:max-w-md md:flex-1"
            label={t('staff.search')}
            value={filters.search}
            onChange={(v) => setFilter('search', v)}
          />
          <Button
            className="md:ml-auto"
            onClick={() => setCreating(true)}
            leadingIcon={<Plus className="size-4" aria-hidden="true" />}
          >
            {t('staff.add')}
          </Button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <SelectField
            label={t('staff.role')}
            className="sm:w-48"
            value={filters.role}
            onChange={(e) => setFilter('role', e.target.value)}
          >
            <option value="">{t('staff.allRoles')}</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </SelectField>
          {branches.length > 1 && (
            <SelectField
              label={t('staff.branch')}
              className="sm:w-56"
              value={filters.branch}
              onChange={(e) => setFilter('branch', e.target.value)}
            >
              <option value="">{t('staff.allBranches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </SelectField>
          )}
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
      </div>

      <Card className="overflow-hidden">
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        ) : data && data.results.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              icon={Users}
              title={t('list.noMatchTitle')}
              description={t('list.noMatchBody')}
            />
          ) : (
            <EmptyState
              icon={Users}
              title={t('staff.emptyTitle')}
              description={t('staff.emptyBody')}
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
                        <Th>{t('staff.name')}</Th>
                        <Th>{t('staff.role')}</Th>
                        <Th>{t('staff.branches')}</Th>
                        <Th className="hidden xl:table-cell">{t('staff.contact')}</Th>
                        <Th className="hidden xl:table-cell">{t('staff.lastActive')}</Th>
                        <Th className="text-right">
                          <span className="sr-only">{t('list.actions')}</span>
                        </Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.results.map((member) => (
                        <tr key={member.id} className="hover:bg-surface-muted/60">
                          <Td>
                            <div className="flex items-center gap-3">
                              <Avatar name={displayName(member)} className="size-9 text-xs" />
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 font-medium">
                                  <span className="truncate">{displayName(member)}</span>
                                  {statusBadge(member)}
                                </p>
                                <p className="truncate text-xs text-ink-muted">
                                  @{member.username}
                                </p>
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <Badge tone="brand">{t(`roles.${member.role}`)}</Badge>
                          </Td>
                          <Td className="max-w-48 text-ink-muted">{branchList(member)}</Td>
                          <Td className="hidden text-ink-muted xl:table-cell">
                            <p className="max-w-56 truncate">{member.email || '—'}</p>
                            {member.phone && <p className="text-xs">{member.phone}</p>}
                          </Td>
                          <Td className="hidden whitespace-nowrap text-ink-muted xl:table-cell">
                            {lastActive(member)}
                          </Td>
                          <Td>{actions(member, true)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {data.results.map((member) => (
                    <li key={member.id} className="flex flex-col gap-3 p-4">
                      <div className="flex items-start gap-3">
                        <Avatar name={displayName(member)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-ink">{displayName(member)}</p>
                          <p className="truncate text-xs text-ink-muted">@{member.username}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <Badge tone="brand">{t(`roles.${member.role}`)}</Badge>
                            {statusBadge(member)}
                          </div>
                        </div>
                      </div>
                      <dl className="flex flex-col gap-1 text-sm text-ink-muted">
                        <div>
                          <dt className="sr-only">{t('staff.branches')}</dt>
                          <dd>{branchList(member)}</dd>
                        </div>
                        {member.email && (
                          <div className="flex items-center gap-2">
                            <dt className="sr-only">{t('profile.email')}</dt>
                            <Mail className="size-4 shrink-0" aria-hidden="true" />
                            <dd className="truncate">{member.email}</dd>
                          </div>
                        )}
                        {member.phone && (
                          <div className="flex items-center gap-2">
                            <dt className="sr-only">{t('profile.phone')}</dt>
                            <Phone className="size-4 shrink-0" aria-hidden="true" />
                            <dd>{member.phone}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="inline">{t('staff.lastActive')}: </dt>
                          <dd className="inline">{lastActive(member)}</dd>
                        </div>
                      </dl>
                      <div className="-mr-2">{actions(member)}</div>
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

      <StaffFormDialog
        open={creating || editing !== null}
        member={editing}
        branches={branches}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
      />
      <SetPasswordDialog member={settingPassword} onClose={() => setSettingPassword(null)} />
      <ConfirmDialog
        open={toDeactivate !== null}
        onClose={() => {
          setToDeactivate(null)
          deactivate.reset()
        }}
        onConfirm={() => toDeactivate && deactivate.mutate(toDeactivate)}
        title={t('staff.deactivateTitle', { name: toDeactivate ? displayName(toDeactivate) : '' })}
        confirmLabel={t('staff.deactivateConfirm')}
        pending={deactivate.isPending}
        error={deactivate.error ? getErrorMessage(deactivate.error) : null}
      >
        <p>{t('staff.deactivateBody')}</p>
      </ConfirmDialog>
    </div>
  )
}
