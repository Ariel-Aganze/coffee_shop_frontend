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
import { TextField } from '@/components/ui/TextField'
import { useFormat } from '@/features/business/useBusiness'
import { amountSchema } from '@/lib/amount'
import { applyServerErrors, fieldMessage } from '@/lib/forms'

import { cashKeys, openSession } from './api'

interface OpenDrawerDialogProps {
  open: boolean
  onClose: () => void
  branch: { id: number; name: string }
}

/** Start a cash session: count the float in the drawer (CASH-001, CASH-002). */
export function OpenDrawerDialog({ open, onClose, branch }: OpenDrawerDialogProps) {
  const { t } = useTranslation()
  const format = useFormat()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const schema = z.object({ opening_balance: amountSchema(format.settings.currencyDecimals) })
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { opening_balance: '' },
  })

  function close() {
    reset()
    setFormError(null)
    onClose()
  }

  const onSubmit = handleSubmit(async ({ opening_balance }) => {
    setFormError(null)
    try {
      await openSession(branch.id, opening_balance)
      toast.success(t('cash.opened', { branch: branch.name }))
      void queryClient.invalidateQueries({ queryKey: cashKeys.all })
      close()
    } catch (error) {
      setFormError(applyServerErrors(error, setError, {}, ['opening_balance']))
    }
  })

  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!isSubmitting}
      title={t('cash.openTitle')}
      description={t('cash.openBody', { branch: branch.name })}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={isSubmitting}>
            {t('changePassword.cancel')}
          </Button>
          <Button type="submit" form="open-drawer-form" loading={isSubmitting}>
            {t('cash.open')}
          </Button>
        </>
      }
    >
      {formError && (
        <Alert tone="danger" className="mb-4">
          {formError}
        </Alert>
      )}
      <form id="open-drawer-form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <TextField
          label={t('cash.openingBalance')}
          hint={t('cash.openingBalanceHint')}
          inputMode="decimal"
          autoComplete="off"
          trailing={
            <span className="pr-3 text-sm text-ink-muted">{format.settings.currencyCode}</span>
          }
          error={fieldMessage(t, errors.opening_balance?.message)}
          {...register('opening_balance')}
        />
      </form>
    </Dialog>
  )
}
