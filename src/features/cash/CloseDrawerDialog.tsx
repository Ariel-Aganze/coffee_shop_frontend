import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { useFormat } from '@/features/business/useBusiness'
import { normalizeAmount } from '@/lib/amount'
import { ApiError, getErrorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/cn'
import { fromMinor, toMinor } from '@/lib/minor'

import { cashKeys, closeSession, type CashSession } from './api'

interface CloseDrawerDialogProps {
  session: CashSession
  /** Expected cash right now (from the reconciliation). */
  expected: string
  open: boolean
  onClose: () => void
}

/** Count the drawer and close the session (CASH-008..CASH-010). */
export function CloseDrawerDialog({ session, expected, open, onClose }: CloseDrawerDialogProps) {
  const { t } = useTranslation()
  const format = useFormat()
  const queryClient = useQueryClient()
  const decimals = session.currency_decimal_places
  const money = (minor: bigint) =>
    format.money(fromMinor(minor, decimals), { currency: session.currency_code, decimals })

  const [counted, setCounted] = useState('')
  const [explanation, setExplanation] = useState('')
  const [errors, setErrors] = useState<{ counted?: string; explanation?: string; form?: string }>(
    {},
  )
  const [pending, setPending] = useState(false)

  const normalized = normalizeAmount(counted)
  const pattern = decimals > 0 ? new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`) : /^\d+$/
  const countedMinor = pattern.test(normalized) ? toMinor(normalized, decimals) : null
  const expectedMinor = toMinor(expected, decimals)
  const difference = countedMinor === null ? null : countedMinor - expectedMinor

  function close() {
    setCounted('')
    setExplanation('')
    setErrors({})
    onClose()
  }

  async function submit() {
    const next: typeof errors = {}
    if (countedMinor === null) next.counted = t('products.amountInvalid')
    else if (difference !== 0n && !explanation.trim()) {
      next.explanation = t('cash.explanationRequired')
    }
    setErrors(next)
    if (Object.keys(next).length) return
    setPending(true)
    try {
      await closeSession(session.id, fromMinor(countedMinor!, decimals), explanation.trim())
      toast.success(t('cash.closed'))
      void queryClient.invalidateQueries({ queryKey: cashKeys.all })
      close()
    } catch (error) {
      setErrors({
        form: getErrorMessage(error),
        ...(error instanceof ApiError && error.fieldErrors.actual_cash
          ? { counted: error.fieldErrors.actual_cash.join(' ') }
          : {}),
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!pending}
      title={t('cash.closeTitle')}
      description={t('cash.closeBody')}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={pending}>
            {t('changePassword.cancel')}
          </Button>
          <Button type="submit" form="close-drawer-form" loading={pending}>
            {t('cash.close')}
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
        id="close-drawer-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <TextField
          label={t('cash.counted')}
          inputMode="decimal"
          autoComplete="off"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          trailing={<span className="pr-3 text-sm text-ink-muted">{session.currency_code}</span>}
          error={errors.counted}
        />
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface-muted p-4 text-sm">
          <div>
            <dt className="text-ink-muted">{t('cash.expected')}</dt>
            <dd className="text-lg font-semibold text-ink tabular-nums">{money(expectedMinor)}</dd>
          </div>
          <div aria-live="polite">
            <dt className="text-ink-muted">{t('cash.difference')}</dt>
            <dd
              className={cn(
                'text-lg font-semibold tabular-nums',
                difference === null || difference === 0n
                  ? 'text-ink'
                  : difference > 0n
                    ? 'text-success'
                    : 'text-danger',
              )}
            >
              {difference === null ? '—' : `${difference > 0n ? '+' : ''}${money(difference)}`}
            </dd>
          </div>
        </dl>
        {difference !== null && difference !== 0n && (
          <TextAreaField
            label={t('cash.explanation')}
            hint={difference > 0n ? t('cash.overHint') : t('cash.shortHint')}
            rows={2}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            error={errors.explanation}
          />
        )}
      </form>
    </Dialog>
  )
}
