import { useTranslation } from 'react-i18next'

import { Badge, type BadgeProps } from '@/components/ui/Badge'

import { saleState, type Sale, type SaleState } from './api'

const TONES: Record<SaleState, NonNullable<BadgeProps['tone']>> = {
  paid: 'success',
  unpaid: 'warning',
  'partly-refunded': 'warning',
  refunded: 'danger',
  cancelled: 'neutral',
}

export function SaleStateBadge({ sale }: { sale: Sale }) {
  const { t } = useTranslation()
  const state = saleState(sale)
  return (
    <Badge tone={TONES[state]} dot>
      {t(`sales.state.${state}`)}
    </Badge>
  )
}
