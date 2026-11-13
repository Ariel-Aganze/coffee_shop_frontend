import { api, unwrap } from '@/lib/api/client'

export const notificationKeys = {
  unreadCount: ['notifications', 'unread-count'] as const,
}

export const fetchUnreadCount = () => unwrap(api.GET('/api/notifications/unread-count/'))
