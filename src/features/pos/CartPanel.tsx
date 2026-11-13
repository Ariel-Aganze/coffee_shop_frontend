import { Minus, Plus, ShoppingBag, Tag, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { useFormat } from '@/features/business/useBusiness'
import { cn } from '@/lib/cn'
import { fromMinor } from '@/lib/minor'

import type { CartTotals, PricedLine } from './cart'

interface CartPanelProps {
  lines: PricedLine[]
  totals: CartTotals
  canDiscount: boolean
  onQuantity: (productId: number, quantity: number) => void
  onDiscount: (line: PricedLine) => void
  onClear: () => void
  onCharge: () => void
  /** False inside the phone dialog, which already shows the title. */
  showTitle?: boolean
  className?: string
}

/** Shopping cart with quantity controls, discounts and totals (POS-004..POS-006). */
export function CartPanel(props: CartPanelProps) {
  const { lines, totals, canDiscount, onQuantity, onDiscount, onClear, onCharge, className } = props
  const showTitle = props.showTitle ?? true
  const { t } = useTranslation()
  const format = useFormat()
  const decimals = format.settings.currencyDecimals
  const money = (minor: bigint) => format.money(fromMinor(minor, decimals))
  const blocked = lines.some((l) => l.problem !== null)

  const problemText: Record<NonNullable<PricedLine['problem']>, string> = {
    unavailable: t('pos.problemUnavailable'),
    'over-stock': t('pos.problemStock'),
    'discount-too-big': t('pos.problemDiscount'),
  }

  return (
    <section
      aria-label={t('pos.cart')}
      className={cn(
        'flex min-h-0 flex-col rounded-card border border-border bg-surface shadow-card',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className={cn('font-semibold text-ink', !showTitle && 'sr-only')}>{t('pos.cart')}</h2>
        {totals.itemCount > 0 && (
          <span className={cn('text-sm text-ink-muted', showTitle && 'mr-auto')}>
            {t('pos.items', { count: totals.itemCount })}
          </span>
        )}
        {lines.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            {t('pos.clear')}
          </Button>
        )}
      </header>

      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center text-ink-muted">
          <ShoppingBag className="size-8" aria-hidden="true" />
          <p className="text-sm">{t('pos.emptyCart')}</p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {lines.map((line) => {
            const name = line.product?.name ?? t('pos.unknownProduct')
            return (
              <li key={line.productId} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{name}</p>
                    {line.product && (
                      <p className="text-xs text-ink-muted tabular-nums">
                        {format.money(line.product.price)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink tabular-nums">
                      {money(line.total)}
                    </p>
                    {line.discountMinor > 0n && (
                      <p className="text-xs text-success tabular-nums">
                        −{money(line.discountMinor)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center rounded-control border border-border">
                    <button
                      type="button"
                      className="grid size-10 place-items-center text-ink-muted hover:text-ink"
                      aria-label={
                        line.quantity === 1
                          ? t('pos.removeLabel', { name })
                          : t('pos.lessLabel', { name })
                      }
                      onClick={() => onQuantity(line.productId, line.quantity - 1)}
                    >
                      {line.quantity === 1 ? (
                        <Trash2 className="size-4" aria-hidden="true" />
                      ) : (
                        <Minus className="size-4" aria-hidden="true" />
                      )}
                    </button>
                    <span
                      className="min-w-8 text-center text-sm font-semibold tabular-nums"
                      aria-label={t('pos.quantityOf', { name, count: line.quantity })}
                    >
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      className="grid size-10 place-items-center text-ink-muted hover:text-ink disabled:opacity-40"
                      aria-label={t('pos.moreLabel', { name })}
                      disabled={!line.product || line.quantity >= line.maxQuantity}
                      onClick={() => onQuantity(line.productId, line.quantity + 1)}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  {canDiscount && line.product && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDiscount(line)}
                      leadingIcon={<Tag className="size-4" aria-hidden="true" />}
                      aria-label={t('pos.discountLabel', { name })}
                    >
                      {line.discountMinor > 0n ? t('pos.editDiscount') : t('pos.discount')}
                    </Button>
                  )}
                </div>
                {line.problem && (
                  <p className="text-xs text-danger" role="alert">
                    {problemText[line.problem]}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <footer className="flex flex-col gap-2 border-t border-border px-4 py-4">
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between text-ink-muted">
            <dt>{t('pos.subtotal')}</dt>
            <dd className="tabular-nums">{money(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0n && (
            <div className="flex justify-between text-success">
              <dt>{t('pos.discounts')}</dt>
              <dd className="tabular-nums">−{money(totals.discount)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-1 text-ink">
            <dt className="font-semibold">{t('pos.total')}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{money(totals.total)}</dd>
          </div>
        </dl>
        <Button
          size="lg"
          className="w-full"
          disabled={lines.length === 0 || blocked}
          onClick={onCharge}
        >
          {lines.length === 0
            ? t('pos.charge')
            : t('pos.chargeAmount', { total: money(totals.total) })}
        </Button>
      </footer>
    </section>
  )
}
