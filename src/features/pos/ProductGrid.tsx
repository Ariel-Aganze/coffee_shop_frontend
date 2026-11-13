import { SearchX } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SearchInput } from '@/components/ui/SearchInput'
import { useFormat } from '@/features/business/useBusiness'
import type { ProductType } from '@/features/products/api'
import { ProductThumb } from '@/features/products/ProductThumb'
import { cn } from '@/lib/cn'

import type { Catalog, CatalogProduct } from './api'
import { stockLimit } from './cart'

interface ProductGridProps {
  catalog: Catalog
  /** Quantity of each product already in the cart. */
  inCart: ReadonlyMap<number, number>
  onAdd: (product: CatalogProduct) => void
}

const tab = (active: boolean) =>
  cn(
    'h-10 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors',
    active
      ? 'bg-primary text-primary-foreground'
      : 'bg-surface text-ink-muted ring-1 ring-border hover:text-ink',
  )

/** Categories, search and the product tiles (POS-002..POS-004). */
export function ProductGrid({ catalog, inCart, onAdd }: ProductGridProps) {
  const { t } = useTranslation()
  const format = useFormat()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<number | 'all'>('all')
  const query = useDeferredValue(search.trim().toLowerCase())

  const visible = catalog.products.filter(
    (p) =>
      (category === 'all' || p.category_id === category) &&
      (!query || p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query)),
  )

  return (
    <section aria-label={t('pos.products')} className="flex min-w-0 flex-col gap-3">
      <SearchInput
        label={t('pos.search')}
        value={search}
        onChange={setSearch}
        debounceMs={0}
        onKeyDown={(e) => {
          // Enter adds the product when the search leaves exactly one.
          if (e.key === 'Enter' && visible.length === 1 && visible[0]!.in_stock) {
            onAdd(visible[0]!)
            setSearch('')
          }
        }}
      />
      {catalog.categories.length > 0 && (
        <div
          role="tablist"
          aria-label={t('pos.categories')}
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={category === 'all'}
            className={tab(category === 'all')}
            onClick={() => setCategory('all')}
          >
            {t('pos.allProducts')}
          </button>
          {catalog.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              className={tab(category === c.id)}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border py-12 text-center text-ink-muted">
          <SearchX className="size-8" aria-hidden="true" />
          <p className="text-sm">
            {catalog.products.length === 0 ? t('pos.noProducts') : t('pos.noMatch')}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
          {visible.map((product) => {
            const quantity = inCart.get(product.id) ?? 0
            const atLimit = quantity >= stockLimit(product)
            const disabled = !product.in_stock || atLimit
            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => onAdd(product)}
                  disabled={disabled}
                  aria-label={t('pos.addLabel', {
                    name: product.name,
                    price: format.money(product.price),
                  })}
                  className={cn(
                    'relative flex h-full w-full flex-col gap-2 rounded-card border bg-surface p-3 text-left shadow-card transition',
                    'hover:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:outline-none active:scale-[0.98]',
                    'disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100',
                    quantity > 0 ? 'border-primary ring-1 ring-primary' : 'border-border',
                  )}
                >
                  <ProductThumb
                    image={product.image}
                    type={product.product_type as ProductType}
                    className="aspect-[16/9] h-auto w-full rounded-xl"
                  />
                  <span className="line-clamp-2 text-sm leading-snug font-medium text-ink">
                    {product.name}
                  </span>
                  <span className="mt-auto flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink tabular-nums">
                      {format.money(product.price)}
                    </span>
                    {!product.in_stock ? (
                      <span className="text-xs font-medium text-danger">{t('pos.outOfStock')}</span>
                    ) : product.is_low_stock ? (
                      <span className="text-xs font-medium text-warning">
                        {t('pos.left', { count: stockLimit(product) })}
                      </span>
                    ) : null}
                  </span>
                  {quantity > 0 && (
                    <span
                      className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow"
                      aria-hidden="true"
                    >
                      {quantity}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
