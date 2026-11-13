import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation } from 'react-router'

import { PageLoader } from '@/components/feedback/Loader'
import { ForbiddenPage } from '@/pages/ErrorPages'

import { useAuth } from './useAuth'
import { can, homePathFor, type Permission } from './permissions'
import { safeNextPath } from './redirects'

/** Only signed-in users; others go to /login and come back afterwards. */
export function RequireAuth() {
  const { t } = useTranslation()
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'restoring') return <PageLoader label={t('app.brewing')} />
  if (status === 'anonymous') {
    const next = location.pathname + location.search
    const query = next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''
    return <Navigate to={`/login${query}`} replace />
  }
  return <Outlet />
}

/** Only signed-out users (the sign-in page); signed-in users go home. */
export function RedirectIfAuthenticated() {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === 'restoring') return <PageLoader />
  if (status === 'authenticated' && user) {
    return <Navigate to={safeNextPath(location.search) ?? homePathFor(user.role)} replace />
  }
  return <Outlet />
}

/** Renders children only for roles with `permission`; otherwise a 403 page. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission
  children: ReactNode
}) {
  const { user } = useAuth()
  return can(user?.role, permission) ? children : <ForbiddenPage />
}

/** `/` → the signed-in user's main screen. */
export function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />
}
