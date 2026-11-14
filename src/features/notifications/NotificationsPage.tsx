import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Banknote,
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  Clock,
  Package,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { ListError, ListSkeleton } from '@/components/feedback/ListStates'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { Segmented } from '@/components/ui/Segmented'
import { SelectField } from '@/components/ui/SelectField'
import { useFormat } from '@/features/business/useBusiness'
import { useListParams } from '@/hooks/useListParams'
import { cn } from '@/lib/cn'

import {
  fetchNotificationPage,
  invalidateNotifications,
  markAllRead,
  markRead,
  notificationKeys,
  notificationLink,
  type Notification,
  type NotificationListParams,
  type NotificationType,
} from './api'

const TYPES = [
  'low_stock',
  'pending_approval',
  'cash_discrepancy',
  'inventory_adjustment',
  'business_event',
] as const satisfies readonly NotificationType[]

const ICONS: Partial<Record<NotificationType, { icon: LucideIcon; tone: string }>> = {
  low_stock: { icon: Package, tone: 'bg-warning-soft text-warning' },
  pending_approval: { icon: Clock, tone: 'bg-info-soft text-info' },
  cash_discrepancy: { icon: Banknote, tone: 'bg-danger-soft text-danger' },
  inventory_adjustment: { icon: AlertTriangle, tone: 'bg-warning-soft text-warning' },
}

/** Your notifications (SRS 5.15, NOT-001..NOT-008): filter, open, mark read. */
export function NotificationsPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { filters, setFilter, hasActiveFilters, page, pageSize, setPage, setPageSize } =
    useListParams(['show', 'type'] as const, { show: 'unread' })
  const show = filters.show === 'all' ? 'all' : 'unread'

  const params: NotificationListParams = {
    page,
    page_size: pageSize,
    ...(show === 'unread' ? { unread: true } : {}),
    ...(filters.type ? { type: filters.type as NotificationType } : {}),
  }
  const query = useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => fetchNotificationPage(params),
    placeholderData: keepPreviousData,
  })
  const readAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => invalidateNotifications(queryClient),
  })
  const open = useMutation({
    mutationFn: (n: Notification) => (n.is_read ? Promise.resolve(n) : markRead(n.id)),
    onSuccess: (_data, n) => {
      invalidateNotifications(queryClient)
      const to = notificationLink(n)
      if (to) void navigate(to)
    },
  })

  const data = query.data
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Segmented
            label={t('notifications.show')}
            value={show}
            onChange={(v) => setFilter('show', v === 'unread' ? '' : v)}
            options={[
              { value: 'unread', label: t('notifications.unread') },
              { value: 'all', label: t('list.statusAll') },
            ]}
          />
          <SelectField
            label={t('notifications.type')}
            className="sm:w-56"
            value={filters.type}
            onChange={(e) => setFilter('type', e.target.value)}
          >
            <option value="">{t('notifications.allTypes')}</option>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`notifications.types.${type}`)}
              </option>
            ))}
          </SelectField>
        </div>
        <Button
          variant="secondary"
          loading={readAll.isPending}
          onClick={() => readAll.mutate()}
          leadingIcon={<CheckCheck className="size-4" aria-hidden="true" />}
        >
          {t('notifications.markAllRead')}
        </Button>
      </div>

      <Card className="overflow-hidden">
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        ) : data && data.results.length === 0 ? (
          <EmptyState
            icon={show === 'unread' && !hasActiveFilters ? BellOff : Bell}
            title={
              show === 'unread' && !filters.type
                ? t('notifications.allCaughtUp')
                : t('list.noMatchTitle')
            }
            description={
              show === 'unread' && !filters.type
                ? t('notifications.allCaughtUpBody')
                : t('list.noMatchBody')
            }
          />
        ) : (
          data && (
            <ul className="divide-y divide-border">
              {data.results.map((n) => {
                const style = ICONS[n.notification_type] ?? {
                  icon: Bell,
                  tone: 'bg-surface-muted text-ink-muted',
                }
                const Icon = style.icon
                const link = notificationLink(n)
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => open.mutate(n)}
                      disabled={!link && n.is_read}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-4 text-left transition-colors sm:px-6',
                        'hover:bg-surface-muted/60 focus-visible:bg-surface-muted focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent',
                        !n.is_read && 'bg-primary-soft/40',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-10 shrink-0 place-items-center rounded-xl',
                          style.tone,
                        )}
                      >
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span
                            className={cn(
                              'text-sm text-ink',
                              n.is_read ? 'font-medium' : 'font-semibold',
                            )}
                          >
                            {!n.is_read && (
                              <span className="sr-only">{t('notifications.unreadLabel')} </span>
                            )}
                            {n.title}
                          </span>
                          <span className="shrink-0 text-xs text-ink-muted">
                            {format.dateTime(n.created_at)}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-sm text-ink-muted">{n.message}</span>
                        {n.branch_name && (
                          <span className="mt-1 block text-xs text-ink-muted">{n.branch_name}</span>
                        )}
                      </span>
                      {link && (
                        <ChevronRight
                          className="mt-2.5 size-4 shrink-0 text-ink-muted"
                          aria-hidden="true"
                        />
                      )}
                      {!n.is_read && (
                        <span
                          className="mt-3.5 size-2 shrink-0 rounded-full bg-primary"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
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
    </div>
  )
}
