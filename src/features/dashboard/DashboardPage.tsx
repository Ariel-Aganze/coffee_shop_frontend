import { LayoutDashboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Logo } from '@/components/brand/Logo'
import { Card } from '@/components/ui/Card'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useBusiness } from '@/features/business/useBusiness'
import { ComingSoonPage } from '@/pages/ComingSoonPage'

/** Step 2: welcome banner (live data) + placeholder. The full dashboard is step 10. */
export function DashboardPage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { business, branch, format } = useBusiness()

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-base text-ink-muted sm:text-lg">
            {t('dashboard.welcome', { name: user.first_name || user.username })}
          </p>
          <p className="truncate text-xl font-semibold text-ink sm:text-2xl">{business?.name}</p>
          <p className="mt-2 text-sm text-ink-muted">
            {t('dashboard.today', { date: format.date(format.today()) })} ·{' '}
            {branch ? t('dashboard.scopeOne', { branch: branch.name }) : t('dashboard.scopeAll')}
          </p>
        </div>
        <Logo className="hidden h-12 sm:block" />
      </Card>
      <ComingSoonPage step={10} icon={LayoutDashboard} />
    </div>
  )
}
