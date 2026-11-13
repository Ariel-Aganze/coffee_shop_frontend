import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Segmented } from '@/components/ui/Segmented'
import { TextField } from '@/components/ui/TextField'
import { useFormat } from '@/features/business/useBusiness'
import { applyServerErrors, fieldMessage } from '@/lib/forms'
import { isoToZonedInput, zonedInputToIso } from '@/lib/zonedTime'

import { createPrice, productKeys, type Product } from './api'
import { amountSchema, marginRatio, toInputAmount } from '@/lib/amount'

function buildSchema(decimals: number, timeZone: string) {
  return z
    .object({
      selling_price: amountSchema(decimals),
      cost_price: amountSchema(decimals, { required: false }),
      when: z.enum(['now', 'later']),
      starts_at: z.string(),
      reason: z.string().trim().max(255),
    })
    .superRefine((v, ctx) => {
      if (v.when !== 'later') return
      const iso = zonedInputToIso(v.starts_at, timeZone)
      if (!iso) {
        ctx.addIssue({ code: 'custom', path: ['starts_at'], message: 'products.startRequired' })
      } else if (new Date(iso).getTime() <= Date.now()) {
        ctx.addIssue({ code: 'custom', path: ['starts_at'], message: 'products.startFuture' })
      }
    })
}
type FormInput = z.input<ReturnType<typeof buildSchema>>
type FormOutput = z.output<ReturnType<typeof buildSchema>>

interface PriceDialogProps {
  open: boolean
  onClose: () => void
  product: Product
}

/** New selling (and cost) price, now or scheduled. Old prices stay in the history. */
export function PriceDialog({ open, onClose, product }: PriceDialogProps) {
  const { t } = useTranslation()
  const format = useFormat()
  const queryClient = useQueryClient()
  const { currencyCode, currencyDecimals } = format.settings
  const [formError, setFormError] = useState<string | null>(null)
  // Earliest pickable start, fixed when the dialog mounts (shop time).
  const [minStart] = useState(() => isoToZonedInput(Date.now(), format.timeZone))

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(buildSchema(currencyDecimals, format.timeZone)),
    values: {
      selling_price: toInputAmount(product.current_price),
      cost_price: toInputAmount(product.current_cost_price),
      when: 'now',
      starts_at: '',
      reason: '',
    },
  })
  const [when, price, cost] = useWatch({
    control,
    name: ['when', 'selling_price', 'cost_price'],
  })

  function close() {
    reset()
    setFormError(null)
    onClose()
  }

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null)
    try {
      await createPrice(product.id, {
        selling_price: data.selling_price,
        cost_price: data.cost_price || '0',
        reason: data.reason,
        ...(data.when === 'later'
          ? { effective_from: zonedInputToIso(data.starts_at, format.timeZone)! }
          : {}),
      })
      toast.success(
        data.when === 'later'
          ? t('products.priceScheduled', { name: product.name })
          : t('products.priceChanged', { name: product.name }),
      )
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
      close()
    } catch (error) {
      setFormError(
        applyServerErrors(error, setError, { effective_from: 'starts_at' }, [
          'selling_price',
          'cost_price',
          'reason',
        ]),
      )
    }
  })

  const err = (field: keyof FormInput) => fieldMessage(t, errors[field]?.message)
  const margin = marginRatio(price, cost || '0')
  const currency = <span className="pr-3 text-sm text-ink-muted">{currencyCode}</span>

  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!isSubmitting}
      title={t('products.changePriceTitle', { name: product.name })}
      description={t('products.changePriceBody')}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={isSubmitting}>
            {t('changePassword.cancel')}
          </Button>
          <Button type="submit" form="price-form" loading={isSubmitting}>
            {when === 'later' ? t('products.schedulePrice') : t('products.savePrice')}
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
        id="price-form"
        onSubmit={(e) => void onSubmit(e)}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        <TextField
          label={t('products.sellingPrice')}
          inputMode="decimal"
          autoComplete="off"
          trailing={currency}
          hint={
            product.current_price
              ? t('products.currentlyPrice', { price: format.money(product.current_price) })
              : undefined
          }
          error={err('selling_price')}
          {...register('selling_price')}
        />
        <TextField
          label={t('products.costPrice')}
          inputMode="decimal"
          autoComplete="off"
          trailing={currency}
          hint={
            margin === null
              ? t('products.costHint')
              : t('products.marginPreview', { margin: format.percent(margin * 100) })
          }
          error={err('cost_price')}
          {...register('cost_price')}
        />
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-medium text-ink">{t('products.startsWhen')}</span>
          <Controller
            control={control}
            name="when"
            render={({ field }) => (
              <Segmented
                label={t('products.startsWhen')}
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'now', label: t('products.startNow') },
                  { value: 'later', label: t('products.startLater') },
                ]}
              />
            )}
          />
        </div>
        {when === 'later' && (
          <TextField
            className="sm:col-span-2"
            type="datetime-local"
            label={t('products.startsAt')}
            hint={t('products.startsAtHint', { zone: format.timeZone })}
            min={minStart}
            error={err('starts_at')}
            {...register('starts_at')}
          />
        )}
        <TextField
          className="sm:col-span-2"
          label={t('products.reason')}
          placeholder={t('products.reasonPlaceholder')}
          autoComplete="off"
          error={err('reason')}
          {...register('reason')}
        />
      </form>
    </Dialog>
  )
}
