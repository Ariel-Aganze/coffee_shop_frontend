import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Loader } from '@/components/feedback/Loader'
import { Button } from '@/components/ui/Button'
import { currencyKeys, fetchCurrencies, type Currency } from '@/features/business/api'
import { cn } from '@/lib/cn'

interface CurrencyPickerProps {
  value: string
  onChange: (code: string) => void
  legend: string
  /** Hide one currency (e.g. the current one when changing). */
  exclude?: string
  error?: string | undefined
}

function matches(currency: Currency, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [currency.code, currency.name, currency.country_hint, currency.symbol].some((field) =>
    field.toLowerCase().includes(q),
  )
}

/**
 * Searchable currency list (CUR-004): search by name, ISO code, country or
 * symbol. A radio group — native keyboard support (arrow keys) and screen
 * reader semantics, no custom widget needed.
 */
export function CurrencyPicker({ value, onChange, legend, exclude, error }: CurrencyPickerProps) {
  const { t } = useTranslation()
  const searchId = useId()
  const errorId = useId()
  const [query, setQuery] = useState('')
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: currencyKeys.all,
    queryFn: fetchCurrencies,
    staleTime: Infinity, // ISO catalogue: practically static
  })

  const visible = useMemo(
    () => (data ?? []).filter((c) => c.code !== exclude && matches(c, query)),
    [data, exclude, query],
  )

  return (
    <fieldset
      aria-describedby={error ? errorId : undefined}
      className="flex min-w-0 flex-col gap-2"
    >
      <legend className="mb-1.5 text-sm font-medium text-ink">{legend}</legend>
      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          {t('currency.search')}
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('currency.search')}
          autoComplete="off"
          className="h-11 w-full rounded-control border border-border bg-surface pr-3.5 pl-10 text-base text-ink placeholder:text-ink-subtle focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none sm:text-sm"
        />
      </div>

      <div
        className={cn(
          'max-h-72 overflow-y-auto rounded-control border bg-surface',
          error ? 'border-danger' : 'border-border',
        )}
      >
        {isPending ? (
          <div className="py-8">
            <Loader size="sm" label={t('currency.loading')} />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center text-sm text-ink-muted">
            {t('currency.loadFailed')}
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              {t('currency.retry')}
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-muted">
            {t('currency.noMatch', { query })}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((currency) => {
              const selected = currency.code === value
              return (
                <li key={currency.code}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors',
                      selected ? 'bg-primary-soft' : 'hover:bg-surface-muted',
                    )}
                  >
                    <input
                      type="radio"
                      name={`currency-${searchId}`}
                      value={currency.code}
                      checked={selected}
                      onChange={() => onChange(currency.code)}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <span className="w-12 shrink-0 font-semibold text-ink">{currency.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{currency.name}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {currency.country_hint}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-ink-muted" aria-hidden="true">
                      {currency.symbol}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  )
}
