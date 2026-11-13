import { CircleAlert, Compass, ShieldX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

const homeLink =
  'bg-primary text-primary-foreground hover:bg-primary-hover rounded-control inline-flex h-11 items-center px-4 text-sm font-medium'

/** Inside the app frame: page doesn't exist. */
export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <Card>
      <EmptyState
        icon={Compass}
        title={t('errors.notFoundCardTitle')}
        description={t('errors.notFoundBody')}
        action={
          <Link to="/" className={homeLink}>
            {t('errors.goHome')}
          </Link>
        }
      />
    </Card>
  )
}

/** Inside the app frame: the role can't use this screen. */
export function ForbiddenPage() {
  const { t } = useTranslation()
  return (
    <Card>
      <EmptyState
        icon={ShieldX}
        title={t('errors.forbiddenTitle')}
        description={t('errors.forbiddenBody')}
        action={
          <Link to="/" className={homeLink}>
            {t('errors.goHome')}
          </Link>
        }
      />
    </Card>
  )
}

/**
 * Router error boundary: an unexpected crash while rendering a page. Works
 * without the app's data providers, so it can't itself fail on them.
 */
export function RouteErrorPage() {
  const { t } = useTranslation()
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-4">
      <Card className="w-full max-w-lg">
        <div className="flex justify-center pt-8">
          <Logo className="h-12" />
        </div>
        <EmptyState
          icon={notFound ? Compass : CircleAlert}
          title={notFound ? t('errors.notFoundTitle') : t('errors.crashTitle')}
          description={notFound ? t('errors.notFoundBody') : t('errors.crashBody')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => window.location.reload()}>{t('errors.reload')}</Button>
              <a
                href="/"
                className="inline-flex h-11 items-center px-4 text-sm font-medium text-primary"
              >
                {t('errors.goHome')}
              </a>
            </div>
          }
        />
      </Card>
    </main>
  )
}
