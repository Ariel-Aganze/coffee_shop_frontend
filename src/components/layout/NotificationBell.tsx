import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { fetchUnreadCount, notificationKeys } from '@/features/notifications/api'

/** Bell with unread count; refreshed every minute and when the tab regains focus. */
export function NotificationBell() {
  const { t } = useTranslation()
  const { data } = useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: fetchUnreadCount,
    refetchInterval: 60_000,
  })
  const unread = data?.unread ?? 0

  return (
    <Link
      to="/notifications"
      aria-label={
        unread > 0 ? t('header.notificationsUnread', { count: unread }) : t('header.notifications')
      }
      className="relative grid size-11 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
    >
      <Bell className="size-5" aria-hidden="true" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-danger px-1 text-[0.6875rem] leading-none font-semibold text-white ring-2 ring-surface"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
