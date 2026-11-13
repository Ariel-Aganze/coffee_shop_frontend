import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { TextField } from '@/components/ui/TextField'
import { businessKeys, updateSettings, type BusinessSettings } from '@/features/business/api'
import { createFormatters } from '@/lib/format'
import { applyServerErrors, fieldMessage } from '@/lib/forms'

import type { DateFormat, Language, NumberFormat } from './regional'
import { DateFormatField, LanguageField, NumberFormatField, TimezoneField } from './RegionalFields'

function useSaveSettings() {
  const queryClient = useQueryClient()
  return async (changes: Parameters<typeof updateSettings>[0]) => {
    const updated = await updateSettings(changes)
    queryClient.setQueryData(businessKeys.settings, updated)
    return updated
  }
}

// ------------------------------------------------------------------ regional
type RegionalValues = {
  language: Language
  timezone: string
  date_format: DateFormat
  number_format: NumberFormat
}
const REGIONAL_FIELDS = ['language', 'timezone', 'date_format', 'number_format'] as const

export function RegionalCard({ settings }: { settings: BusinessSettings }) {
  const { t } = useTranslation()
  const save = useSaveSettings()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<RegionalValues>({
    values: {
      language: settings.language,
      timezone: settings.timezone,
      date_format: settings.date_format,
      number_format: settings.number_format,
    },
  })
  const draft = useWatch({ control }) as RegionalValues
  const preview = createFormatters({
    currencyCode: settings.primary_currency.code,
    currencyDecimals: settings.primary_currency.decimal_places,
    timezone: draft.timezone,
    numberFormat: draft.number_format,
    dateFormat: draft.date_format,
    language: draft.language,
  })
  // Sample moment for the preview, taken once (render must stay pure).
  const [now] = useState(() => new Date())

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null)
    try {
      await save(data)
      reset(data)
      toast.success(t('settings.saved'))
    } catch (error) {
      setFormError(applyServerErrors(error, setError, {}, REGIONAL_FIELDS))
    }
  })

  return (
    <Card>
      <CardHeader title={t('settings.regionalTitle')} description={t('settings.regionalHint')} />
      <CardBody>
        {formError && (
          <Alert tone="danger" className="mb-4">
            {formError}
          </Alert>
        )}
        <form onSubmit={(e) => void onSubmit(e)} noValidate className="grid gap-4 sm:grid-cols-2">
          <TimezoneField
            error={fieldMessage(t, errors.timezone?.message)}
            {...register('timezone')}
          />
          <LanguageField
            error={fieldMessage(t, errors.language?.message)}
            {...register('language')}
          />
          <DateFormatField
            error={fieldMessage(t, errors.date_format?.message)}
            {...register('date_format')}
          />
          <NumberFormatField
            error={fieldMessage(t, errors.number_format?.message)}
            {...register('number_format')}
          />
          <div
            className="rounded-control bg-surface-muted px-4 py-3 text-sm sm:col-span-2"
            aria-live="polite"
          >
            <span className="text-ink-muted">{t('settings.preview')}: </span>
            <span className="font-medium text-ink">
              {preview.money('1250000.5')} · {preview.date(now)} {preview.time(now)}
            </span>
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              {t('profile.save')}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

// ------------------------------------------------------------------ point of sale
const posSchema = z.object({
  cashier_max_discount_percent: z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, 'settings.percentInvalid')
    .refine((v) => Number(v) <= 100, 'settings.percentInvalid'),
})
type PosValues = z.infer<typeof posSchema>

export function PosCard({ settings }: { settings: BusinessSettings }) {
  const { t } = useTranslation()
  const save = useSaveSettings()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<PosValues>({
    resolver: zodResolver(posSchema),
    values: { cashier_max_discount_percent: String(Number(settings.cashier_max_discount_percent)) },
  })

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null)
    try {
      await save(data)
      reset(data)
      toast.success(t('settings.saved'))
    } catch (error) {
      setFormError(applyServerErrors(error, setError, {}, ['cashier_max_discount_percent']))
    }
  })

  return (
    <Card>
      <CardHeader title={t('settings.posTitle')} description={t('settings.posHint')} />
      <CardBody>
        {formError && (
          <Alert tone="danger" className="mb-4">
            {formError}
          </Alert>
        )}
        <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
          <TextField
            label={t('settings.discountLimit')}
            hint={t('settings.discountHint')}
            inputMode="decimal"
            trailing={<span className="pr-3 text-sm text-ink-muted">%</span>}
            error={fieldMessage(t, errors.cashier_max_discount_percent?.message)}
            className="sm:max-w-xs"
            {...register('cashier_max_discount_percent')}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              {t('profile.save')}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
