import type { QueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/lib/api/client'
import type { operations, Schema } from '@/lib/api/types'

export type Notification = Schema<'Notification'>
export type NotificationType = Schema<'NotificationTypeEnum'>
export type NotificationListParams = NonNullable<
  operations['notifications_list']['parameters']['query']
>

export const notificationKeys = {
  all: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  list: (params: NotificationListParams) => ['notifications', 'list', params] as const,
}

export const fetchUnreadCount = () => unwrap(api.GET('/api/notifications/unread-count/'))

export const fetchNotificationPage = (params: NotificationListParams) =>
  unwrap(api.GET('/api/notifications/', { params: { query: params } }))

export const markRead = (id: number) =>
  unwrap(api.POST('/api/notifications/{id}/mark-read/', { params: { path: { id } } }))

export const markAllRead = () => unwrap(api.POST('/api/notifications/mark-all-read/'))

export function invalidateNotifications(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
}

/** Where a notification takes you, from its type and metadata (null = nowhere). */
export function notificationLink(n: Notification): string | null {
  const meta = (n.metadata ?? {}) as Record<string, unknown>
  switch (n.notification_type) {
    case 'low_stock':
      return typeof meta.sku === 'string'
        ? `/inventory?search=${encodeURIComponent(meta.sku)}`
        : '/inventory?level=low'
    case 'cash_discrepancy':
      return meta.session_id ? `/cash/${String(meta.session_id)}` : '/cash'
    case 'pending_approval':
      return meta.expense_id ? `/expenses/${String(meta.expense_id)}` : '/expenses'
    case 'inventory_adjustment':
    case 'stock_transfer':
      return '/inventory/movements'
    default:
      return null
  }
}
