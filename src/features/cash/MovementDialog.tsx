import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField } from '@/components/ui/SelectField'
import { TextField } from '@/components/ui/TextField'
import { useFormat } from '@/features/business/useBusiness'
import { amountSchema } from '@/lib/amount'
import { applyServerErrors, fieldMessage } from '@/lib/forms'

import { addMovement, cashKeys, type CashSession } from './api'

/** Cash refunds are recorded by the sales refund flow, not by hand. */
const TYPES = ['inflow', 'withdrawal', 'expense'] as const

interface MovementDialogProps {
  session: CashSession
  open: boolean
  onClose: () => void
}

/** Cash put into or taken out of the drawer, always with a reason (CASH-005, CASH-006). */
export function MovementDialog({ session, open, onClose }: MovementDialogProps) {
  const { t } = useTranslation()
  const format = useFormat()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const schema = z.object({
    movement_type: z.enum(TYPES),
    amount: amountSchema(session.currency_decimal_places),
    reason: z.string().trim().min(1, 'cash.reasonRequired').max(500),
    reference: z.string().trim().max(100),
  })
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { movement_type: 'withdrawal', amount: '', reason: '', reference: '' },
  })

  function close() {
    reset()
    setFormError(null)
    onClose()
  }

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null)
    try {
      await addMovement(session.id, data)
      toast.success(t('cash.movementSaved'))
      void queryClient.invalidateQueries({ queryKey: cashKeys.all })
      close()
    } catch (error) {
      setFormError(
        applyServerErrors(error, setError, {}, ['movement_type', 'amount', 'reason', 'reference']),
      )
    }
  })
  const err = (f: keyof z.input<typeof schema>) => fieldMessage(t, errors[f]?.message)

  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!isSubmitting}
      title={t('cash.movementTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={isSubmitting}>
            {t('changePassword.cancel')}
          </Button>
          <Button type="submit" form="movement-form" loading={isSubmitting}>
            {t('cash.recordMovement')}
          </Button>
        </>
      }
    >
      {formError && (
        <Alert tone="danger" className="mb-4">
          {formError}
        </Alert>
      )}
      <form
        id="movement-form"
        onSubmit={(e) => void onSubmit(e)}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        <SelectField
          label={t('cash.movementType')}
          error={err('movement_type')}
          {...register('movement_type')}
        >
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`cash.types.${type}`)}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t('cash.amount')}
          inputMode="decimal"
          autoComplete="off"
          trailing={<span className="pr-3 text-sm text-ink-muted">{session.currency_code}</span>}
          error={err('amount')}
          {...register('amount')}
        />
        <TextField
          className="sm:col-span-2"
          label={t('cash.reason')}
          placeholder={t('cash.reasonPlaceholder')}
          autoComplete="off"
          error={err('reason')}
          {...register('reason')}
        />
        <TextField
          className="sm:col-span-2"
          label={t('cash.reference')}
          autoComplete="off"
          error={err('reference')}
          {...register('reference')}
        />
        <p className="text-sm text-ink-muted sm:col-span-2">
          {t('cash.movementHint', { currency: format.settings.currencyCode })}
        </p>
      </form>
    </Dialog>
  )
}
