import { useTranslation } from 'react-i18next'

import { TabNav } from '@/components/ui/TabNav'
import { can } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/auth/useAuth'

/** Stock | Movements | Stock count. */
export function InventoryTabs() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  return (
    <TabNav
      label={t('stock.sections')}
      items={[
        { to: '/inventory', label: t('stock.tabStock'), end: true },
        { to: '/inventory/movements', label: t('stock.tabMovements') },
        ...(can(user.role, 'inventory.manage')
          ? [{ to: '/inventory/count', label: t('stock.tabCount') }]
          : []),
      ]}
    />
  )
}
