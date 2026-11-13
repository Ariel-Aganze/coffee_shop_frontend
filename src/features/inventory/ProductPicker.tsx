import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SearchInput } from '@/components/ui/SearchInput'
import { fetchProductPage, productKeys, type Product } from '@/features/products/api'
import { ProductThumb } from '@/features/products/ProductThumb'
import { cn } from '@/lib/cn'

interface ProductPickerProps {
  value: Product | null
  onChange: (product: Product) => void
  error?: string | undefined
}

/** Search active products by name or SKU and pick one (radio list). */
export function ProductPicker({ value, onChange, error }: ProductPickerProps) {
  const { t } = useTranslation()
  const id = useId()
  const [search, setSearch] = useState('')
  const params = { is_active: true, page_size: 8, ...(search ? { search } : {}) }
  const query = useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => fetchProductPage(params),
  })
  const results = query.data?.results ?? []

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-1.5 text-sm font-medium text-ink">{t('stock.product')}</legend>
      <SearchInput label={t('stock.findProduct')} value={search} onChange={setSearch} />
      <div className="max-h-64 overflow-y-auto rounded-control border border-border">
        {query.isPending ? (
          <p className="p-3 text-sm text-ink-muted">{t('app.loading')}</p>
        ) : results.length === 0 ? (
          <p className="p-3 text-sm text-ink-muted">{t('list.noMatchTitle')}</p>
        ) : (
          results.map((p) => (
            <label
              key={p.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-0',
                'has-[:focus-visible]:bg-surface-muted',
                value?.id === p.id ? 'bg-primary-soft' : 'hover:bg-surface-muted',
              )}
            >
              <input
                type="radio"
                name={`${id}-product`}
                className="size-4 accent-primary"
                checked={value?.id === p.id}
                onChange={() => onChange(p)}
              />
              <ProductThumb image={p.image} type={p.product_type} className="size-9" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                <span className="block text-xs text-ink-muted">{p.sku}</span>
              </span>
            </label>
          ))
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  )
}
