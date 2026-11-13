import { Hammer, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

interface ComingSoonPageProps {
  /** Build-plan step that delivers this screen. */
  step: number
  icon?: LucideIcon
}

/** Placeholder for screens of later build steps, so navigation is complete now. */
export function ComingSoonPage({ step, icon = Hammer }: ComingSoonPageProps) {
  const { t } = useTranslation()
  return (
    <Card>
      <EmptyState
        icon={icon}
        title={t('comingSoon.title', { step })}
        description={t('comingSoon.body', { step })}
      />
    </Card>
  )
}
