import { Menu } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useMatches } from 'react-router'

import { Loader, PageLoader } from '@/components/feedback/Loader'
import { env } from '@/config/env'
import { BusinessProvider } from '@/features/business/BusinessProvider'
import { useBusiness } from '@/features/business/useBusiness'

import { BranchPicker } from './BranchPicker'
import { MobileNav } from './MobileNav'
import { NotificationBell } from './NotificationBell'
import { SidebarNav } from './SidebarNav'
import { UserMenu } from './UserMenu'
import type { RouteHandle } from './routeHandle'

/** Page title from the deepest matched route's `handle.title`. */
function usePageTitle(): string {
  const { t } = useTranslation()
  const matches = useMatches()
  const handle = matches.toReversed().find((m) => (m.handle as RouteHandle | undefined)?.title)
    ?.handle as RouteHandle | undefined
  const title = handle ? t(handle.title) : ''
  useEffect(() => {
    document.title = title ? `${title} · ${env.VITE_APP_NAME}` : env.VITE_APP_NAME
  }, [title])
  return title
}

function Shell() {
  const { t } = useTranslation()
  const title = usePageTitle()
  const [menuOpen, setMenuOpen] = useState(false)
  const { isLoading } = useBusiness()

  if (isLoading) return <PageLoader label={t('app.brewing')} />

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t('app.skipToContent')}
      </a>

      <aside className="sticky top-0 hidden h-dvh border-r border-border bg-surface lg:block">
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur sm:gap-3 sm:px-6 lg:h-20 lg:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t('nav.openMenu')}
            aria-expanded={menuOpen}
            className="grid size-11 shrink-0 place-items-center rounded-xl text-ink hover:bg-surface-muted lg:hidden"
          >
            <Menu className="size-6" aria-hidden="true" />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight text-ink lg:text-[1.75rem]">
            {title}
          </h1>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <BranchPicker className="hidden w-48 sm:block lg:w-56" />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 p-4 outline-none sm:p-6 lg:p-8">
          <Suspense
            fallback={
              <div className="grid min-h-[50vh] place-items-center">
                <Loader label={t('app.loading')} />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>

      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}

/** Signed-in app frame: sidebar, header and page outlet. */
export function AppLayout() {
  return (
    <BusinessProvider>
      <Shell />
    </BusinessProvider>
  )
}
