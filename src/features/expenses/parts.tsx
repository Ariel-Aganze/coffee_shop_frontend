import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/Badge'
import { TabNav } from '@/components/ui/TabNav'

import type { ExpenseStatus } from './api'

const TONES = { pending: 'warning', approved: 'success', rejected: 'danger' } as const

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const { t } = useTranslation()
  return (
    <Badge tone={TONES[status]} dot>
      {t(`expenses.status.${status}`)}
    </Badge>
  )
}

/** Expenses | Categories. */
export function ExpenseTabs() {
  const { t } = useTranslation()
  return (
    <TabNav
      label={t('expenses.sections')}
      items={[
        { to: '/expenses', label: t('nav.expenses'), end: true },
        { to: '/expenses/categories', label: t('expenses.categoriesTab') },
      ]}
    />
  )
}
