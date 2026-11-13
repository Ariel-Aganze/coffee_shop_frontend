import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { cashKeys } from '@/features/cash/api'
import { useFormat } from '@/features/business/useBusiness'
import { normalizeAmount } from '@/lib/amount'
import { getErrorMessage } from '@/lib/api/errors'
import { fromMinor, toMinor } from '@/lib/minor'

import { refundSale, saleKeys, type Sale } from './api'

interface RefundDialogProps {
  sale: Sale
  open: boolean
  onClose: () => void
}

/** Full or partial refund with a reason (POS-018, POS-020, BRULE-013). */
export function RefundDialog({ sale, open, onClose }: RefundDialogProps) {
  const { t } = useTranslation()
  const format = useFormat()
  const queryClient = useQueryClient()
  const decimals = sale.currency_decimal_places
  const refundable = toMinor(sale.paid_amount, decimals) - toMinor(sale.refunded_amount, decimals)
  const money = (minor: bigint) =>
    format.money(fromMinor(minor, decimals), { currency: sale.currency_code, decimals })

  const [amount, setAmount] = useState(fromMinor(refundable, decimals))
  const [reason, setReason] = useState('')
  const [restock, setRestock] = useState(false)
  const [errors, setErrors] = useState<{ amount?: string; reason?: string; form?: string }>({})
  const [pending, setPending] = useState(false)

  const normalized = normalizeAmount(amount)
  const pattern = decimals > 0 ? new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`) : /^\d+$/
  const minor = pattern.test(normalized) ? toMinor(normalized, decimals) : null
  // Restocking is only possible on the refund that settles the whole sale.
  const isFull = minor !== null && minor === refundable

  function close() {
    setAmount(fromMinor(refundable, decimals))
    setReason('')
    setRestock(false)
    setErrors({})
    onClose()
  }

  async function submit() {
    const next: typeof errors = {}
    if (minor === null || minor <= 0n) next.amount = t('products.amountInvalid')
    else if (minor > refundable) next.amount = t('sales.refundTooMuch', { max: money(refundable) })
    if (!reason.trim()) next.reason = t('sales.reasonRequired')
    setErrors(next)
    if (Object.keys(next).length) return
    setPending(true)
    try {
      await refundSale(sale.id, {
        amount: fromMinor(minor!, decimals),
        reason: reason.trim(),
        restock: isFull && restock,
      })
      toast.success(t('sales.refunded', { amount: money(minor!) }))
      void queryClient.invalidateQueries({ queryKey: saleKeys.all })
      void queryClient.invalidateQueries({ queryKey: cashKeys.all })
      close()
    } catch (error) {
      setErrors({ form: getErrorMessage(error) })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!pending}
      title={t('sales.refundTitle', { number: sale.transaction_number })}
      description={t('sales.refundBody', { max: money(refundable) })}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={pending}>
            {t('changePassword.cancel')}
          </Button>
          <Button variant="danger" type="submit" form="refund-form" loading={pending}>
            {t('sales.refund')}
          </Button>
        </>
      }
    >
      {errors.form && (
        <Alert tone="danger" className="mb-4">
          {errors.form}
        </Alert>
      )}
      <form
        id="refund-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <TextField
          label={t('sales.refundAmount')}
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          trailing={<span className="pr-3 text-sm text-ink-muted">{sale.currency_code}</span>}
          error={errors.amount}
        />
        <TextAreaField
          label={t('sales.reason')}
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={errors.reason}
        />
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={isFull && restock}
            disabled={!isFull}
            onChange={(e) => setRestock(e.target.checked)}
          />
          <span>
            {t('sales.restock')}
            <span className="block text-ink-muted">
              {isFull ? t('sales.restockHint') : t('sales.restockFullOnly')}
            </span>
          </span>
        </label>
      </form>
    </Dialog>
  )
}
