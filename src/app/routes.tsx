/**
 * All routes. Pages are lazy-loaded so each feature ships as its own chunk.
 *
 * Every signed-in page declares its required permission (RequirePermission)
 * and its title (handle.title, shown in the header and the browser tab).
 * Screens of later build steps render <ComingSoonPage step={n} />.
 */
import { Bell, ChartColumn, ScrollText, Wallet } from 'lucide-react'
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
const BranchesPage = lazy(() =>
  import('@/features/branches/BranchesPage').then((m) => ({ default: m.BranchesPage })),
)
const StaffPage = lazy(() =>
  import('@/features/staff/StaffPage').then((m) => ({ default: m.StaffPage })),
)
const ProductsPage = lazy(() =>
  import('@/features/products/ProductsPage').then((m) => ({ default: m.ProductsPage })),
)
const CategoriesPage = lazy(() =>
  import('@/features/products/CategoriesPage').then((m) => ({ default: m.CategoriesPage })),
)
const ProductDetailPage = lazy(() =>
  import('@/features/products/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })),
)
const PosPage = lazy(() => import('@/features/pos/PosPage').then((m) => ({ default: m.PosPage })))
const SalesPage = lazy(() =>
  import('@/features/sales/SalesPage').then((m) => ({ default: m.SalesPage })),
)
const SaleDetailPage = lazy(() =>
  import('@/features/sales/SaleDetailPage').then((m) => ({ default: m.SaleDetailPage })),
)
const CashPage = lazy(() =>
  import('@/features/cash/CashPage').then((m) => ({ default: m.CashPage })),
)
const CashSessionPage = lazy(() =>
  import('@/features/cash/CashSessionPage').then((m) => ({ default: m.CashSessionPage })),
)
const StockPage = lazy(() =>
  import('@/features/inventory/StockPage').then((m) => ({ default: m.StockPage })),
)
const MovementsPage = lazy(() =>
  import('@/features/inventory/MovementsPage').then((m) => ({ default: m.MovementsPage })),
)
const StockCountPage = lazy(() =>
  import('@/features/inventory/StockCountPage').then((m) => ({ default: m.StockCountPage })),
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
              page('/pos', 'nav.pos', <PosPage />, 'pos.use'),
              page('/sales', 'nav.sales', <SalesPage />, 'sales.view'),
              page('/sales/:saleId', 'nav.sales', <SaleDetailPage />, 'sales.view'),
              page('/cash', 'nav.cash', <CashPage />, 'cash.view'),
              page('/cash/:sessionId', 'nav.cash', <CashSessionPage />, 'cash.view'),
              page('/products', 'nav.products', <ProductsPage />, 'products.view'),
              page('/products/categories', 'categories.title', <CategoriesPage />, 'products.view'),
              page('/products/:productId', 'nav.products', <ProductDetailPage />, 'products.view'),
              page('/inventory', 'nav.inventory', <StockPage />, 'inventory.view'),
              page('/inventory/movements', 'nav.inventory', <MovementsPage />, 'inventory.view'),
              page('/inventory/count', 'stock.countPage', <StockCountPage />, 'inventory.manage'),
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
              page('/staff', 'nav.staff', <StaffPage />, 'staff.manage'),
              page('/branches', 'nav.branches', <BranchesPage />, 'branches.view'),
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
