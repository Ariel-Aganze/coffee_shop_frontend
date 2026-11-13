import { Boxes, ChartColumn, ChevronRight, Landmark, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Card } from '@/components/ui/Card'
import { useCurrentUser } from '@/features/auth/useAuth'

import { reportsFor, type ReportDef } from './catalog'

const SECTIONS: { key: ReportDef['section']; icon: LucideIcon }[] = [
  { key: 'sales', icon: ChartColumn },
  { key: 'inventory', icon: Boxes },
  { key: 'finance', icon: Landmark },
]

/** The reports this role may open, by section (SRS 5.11). */
export function ReportsPage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const available = reportsFor(user.role)

  return (
    <div className="flex flex-col gap-6">
      {user.role === 'cashier' && <p className="text-sm text-ink-muted">{t('reports.ownSales')}</p>}
      {SECTIONS.map(({ key, icon: Icon }) => {
        const reports = available.filter((r) => r.section === key)
        if (reports.length === 0) return null
        return (
          <section key={key} aria-labelledby={`reports-${key}`} className="flex flex-col gap-3">
            <h2
              id={`reports-${key}`}
              className="flex items-center gap-2 text-lg font-semibold text-ink"
            >
              <Icon className="size-5 text-primary" aria-hidden="true" />
              {t(`reports.sections.${key}`)}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {reports.map((r) => (
                <li key={r.slug}>
                  <Card className="h-full transition-colors hover:border-primary/40">
                    <Link
                      to={`/reports/${r.slug}`}
                      className="flex h-full items-start justify-between gap-3 p-4 sm:p-5"
                    >
                      <span>
                        <span className="block font-semibold text-ink">
                          {t(`reports.list.${r.slug}.title`)}
                        </span>
                        <span className="mt-1 block text-sm text-ink-muted">
                          {t(`reports.list.${r.slug}.description`)}
                        </span>
                      </span>
                      <ChevronRight
                        className="mt-0.5 size-4 shrink-0 text-ink-muted"
                        aria-hidden="true"
                      />
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
