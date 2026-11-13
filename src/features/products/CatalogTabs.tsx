import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

import { cn } from '@/lib/cn'

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium transition-colors',
    isActive ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
  )

/** Products | Categories switcher shown at the top of both pages. */
export function CatalogTabs() {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('products.sections')}>
      <div className="inline-flex gap-1 rounded-xl bg-surface-muted p-1">
        <NavLink to="/products" end className={tab}>
          {t('nav.products')}
        </NavLink>
        <NavLink to="/products/categories" className={tab}>
          {t('categories.title')}
        </NavLink>
      </div>
    </nav>
  )
}
