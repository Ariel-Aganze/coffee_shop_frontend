import { useTranslation } from 'react-i18next'

import { TabNav } from '@/components/ui/TabNav'

/** Products | Categories switcher shown at the top of both pages. */
export function CatalogTabs() {
  const { t } = useTranslation()
  return (
    <TabNav
      label={t('products.sections')}
      items={[
        { to: '/products', label: t('nav.products'), end: true },
        { to: '/products/categories', label: t('categories.title') },
      ]}
    />
  )
}
