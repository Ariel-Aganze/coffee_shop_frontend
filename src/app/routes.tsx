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
  KeyRound,
  ReceiptText,
  ScrollText,
  Settings,
  ShoppingCart,
  UserRound,
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
import { PublicComingSoonPage } from '@/pages/PublicComingSoonPage'

const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
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
        children: [{ path: '/login', element: <LoginPage /> }],
      },
      { path: '/forgot-password', element: <PublicComingSoonPage step={3} /> },
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
              page(
                '/settings',
                'nav.settings',
                <ComingSoonPage step={4} icon={Settings} />,
                'settings.manage',
              ),
              page(
                '/audit',
                'nav.audit',
                <ComingSoonPage step={12} icon={ScrollText} />,
                'audit.view',
              ),
              page('/notifications', 'nav.notifications', <ComingSoonPage step={12} icon={Bell} />),
              page('/profile', 'nav.profile', <ComingSoonPage step={3} icon={UserRound} />),
              page(
                '/profile/password',
                'header.changePassword',
                <ComingSoonPage step={3} icon={KeyRound} />,
              ),
              page('*', 'errors.notFoundTitle', <NotFoundPage />),
            ],
          },
        ],
      },
    ],
  },
]
