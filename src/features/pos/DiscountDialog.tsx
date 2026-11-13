import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/TextField'
import { useFormat } from '@/features/business/useBusiness'
import { normalizeAmount } from '@/lib/amount'
import { fromMinor, percentOf, toMinor } from '@/lib/minor'

import type { Discount } from './api'
import { maxDiscount, type PricedLine } from './cart'

interface DiscountDialogProps {
  line: PricedLine | null
  allowance: Discount
  onClose: () => void
  onApply: (productId: number, discount: string) => void
}

/** Line discount (POS-008), limited to the cashier's allowance. */
export function DiscountDialog({ line, allowance, onClose, onApply }: DiscountDialogProps) {
  const { t } = useTranslation()
  const format = useFormat()
  const decimals = format.settings.currencyDecimals
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Reset the field whenever another line is opened.
  const [forLine, setForLine] = useState<number | null>(null)
  if (line && line.productId !== forLine) {
    setForLine(line.productId)
    setValue(line.discountMinor > 0n ? fromMinor(line.discountMinor, decimals) : '')
    setError(null)
  }
  if (!line?.product) return null

  const limit = maxDiscount(line.gross, allowance)
  const presets = ['5', '10', '20']
    .map((p) => ({ label: `${p}%`, minor: percentOf(line.gross, p) }))
    .filter((p) => p.minor <= limit)

  function apply() {
    const v = normalizeAmount(value) || '0'
    const pattern = decimals > 0 ? new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`) : /^\d+$/
    if (!pattern.test(v)) return setError(t('products.amountInvalid'))
    if (toMinor(v, decimals) > limit) {
      return setError(t('pos.discountTooBig', { max: format.money(fromMinor(limit, decimals)) }))
    }
    onApply(line!.productId, fromMinor(toMinor(v, decimals), decimals))
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('pos.discountTitle', { name: line.product.name })}
      description={
        allowance.unlimited
          ? t('pos.discountAnyBody', { total: format.money(fromMinor(line.gross, decimals)) })
          : t('pos.discountLimitBody', {
              percent: Number(allowance.max_percent),
              max: format.money(fromMinor(limit, decimals)),
            })
      }
      footer={
        <>
          {line.discountMinor > 0n && (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => {
                onApply(line.productId, '0')
                onClose()
              }}
            >
              {t('pos.removeDiscount')}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t('changePassword.cancel')}
          </Button>
          <Button type="submit" form="discount-form">
            {t('pos.applyDiscount')}
          </Button>
        </>
      }
    >
      <form
        id="discount-form"
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          apply()
        }}
      >
        <TextField
          label={t('pos.discountAmount')}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          trailing={
            <span className="pr-3 text-sm text-ink-muted">{format.settings.currencyCode}</span>
          }
          error={error ?? undefined}
        />
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button
                key={p.label}
                variant="secondary"
                size="sm"
                onClick={() => setValue(fromMinor(p.minor, decimals))}
              >
                {p.label}
              </Button>
            ))}
          </div>
        )}
      </form>
    </Dialog>
  )
}
