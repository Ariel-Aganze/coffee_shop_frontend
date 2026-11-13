/**
 * All routes. Pages are lazy-loaded so each feature ships as its own chunk.
 *
 * Every signed-in page declares its required permission (RequirePermission)
 * and its title (handle.title, shown in the header and the browser tab).
 * Screens of later build steps render <ComingSoonPage step={n} />.
 */
import {
  Banknote,
  Bell,
  Boxes,
  Building2,
  ChartColumn,
  Coffee,
  ReceiptText,
  ScrollText,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react'
import { lazy, type ReactNode } from 'react'
import type { RouteObject } from 'react-router'

import { AppLayout } from '@/components/layout/AppLayout'
import type { RouteHandle } from '@/components/layout/routeHandle'
import {
  HomeRedirect,
  RedirectIfAuthenticated,
  RequireAuth,
  RequirePermission,
} from '@/features/auth/guards'
import type { Permission } from '@/features/auth/permissions'
import { ComingSoonPage } from '@/pages/ComingSoonPage'
import { NotFoundPage, RouteErrorPage } from '@/pages/ErrorPages'

const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
)
const ResetPasswordPage = lazy(() =>
  import('@/features/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
)
const ProfilePage = lazy(() =>
  import('@/features/account/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const ChangePasswordPage = lazy(() =>
  import('@/features/account/ChangePasswordPage').then((m) => ({ default: m.ChangePasswordPage })),
)
const RegisterPage = lazy(() =>
  import('@/features/onboarding/RegisterPage').then((m) => ({ default: m.RegisterPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)

function page(
  path: string,
  title: RouteHandle['title'],
  element: ReactNode,
  permission?: Permission,
): RouteObject {
  return {
    path,
    handle: { title } satisfies RouteHandle,
    element: permission ? (
      <RequirePermission permission={permission}>{element}</RequirePermission>
    ) : (
      element
    ),
  }
}

export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
      // Usable signed in or out (e.g. following an emailed link on a shared device).
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomeRedirect /> },
          {
            element: <AppLayout />,
            children: [
              page('/dashboard', 'nav.dashboard', <DashboardPage />, 'dashboard.view'),
              page('/pos', 'nav.pos', <ComingSoonPage step={7} icon={ShoppingCart} />, 'pos.use'),
              page(
                '/sales',
                'nav.sales',
                <ComingSoonPage step={7} icon={ReceiptText} />,
                'sales.view',
              ),
              page('/cash', 'nav.cash', <ComingSoonPage step={7} icon={Banknote} />, 'cash.view'),
              page(
                '/products',
                'nav.products',
                <ComingSoonPage step={6} icon={Coffee} />,
                'products.view',
              ),
              page(
                '/inventory',
                'nav.inventory',
                <ComingSoonPage step={8} icon={Boxes} />,
                'inventory.view',
              ),
              page(
                '/expenses',
                'nav.expenses',
                <ComingSoonPage step={9} icon={Wallet} />,
                'expenses.view',
              ),
              page(
                '/reports',
                'nav.reports',
                <ComingSoonPage step={11} icon={ChartColumn} />,
                'reports.view',
              ),
              page('/staff', 'nav.staff', <ComingSoonPage step={5} icon={Users} />, 'staff.manage'),
              page(
                '/branches',
                'nav.branches',
                <ComingSoonPage step={5} icon={Building2} />,
                'branches.view',
              ),
              page('/settings', 'nav.settings', <SettingsPage />, 'settings.manage'),
              page(
                '/audit',
                'nav.audit',
                <ComingSoonPage step={12} icon={ScrollText} />,
                'audit.view',
              ),
              page('/notifications', 'nav.notifications', <ComingSoonPage step={12} icon={Bell} />),
              page('/profile', 'nav.profile', <ProfilePage />),
              page('/profile/password', 'header.changePassword', <ChangePasswordPage />),
              page('*', 'errors.notFoundTitle', <NotFoundPage />),
            ],
          },
        ],
      },
    ],
  },
]
