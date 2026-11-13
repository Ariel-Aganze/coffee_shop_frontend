import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImageUp, Store, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { TextField } from '@/components/ui/TextField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import {
  businessKeys,
  removeLogo,
  updateBusiness,
  uploadLogo,
  type Business,
} from '@/features/business/api'
import { applyServerErrors, fieldMessage } from '@/lib/forms'

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const schema = z.object({
  name: z.string().trim().min(1, 'onboarding.required').max(255),
  contact_email: z.union([z.literal(''), z.email('onboarding.emailInvalid')]),
  contact_phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s().-]*$/, 'profile.phoneInvalid'),
  address: z.string().trim().max(500),
})
type FormValues = z.infer<typeof schema>
const FIELDS = ['name', 'contact_email', 'contact_phone', 'address'] as const

function LogoUploader({ business }: { business: Business }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const onSaved = (updated: Business) => {
    queryClient.setQueryData(businessKeys.profile, updated)
    setProblem(null)
  }
  const upload = useMutation({
    mutationFn: uploadLogo,
    onSuccess: (updated) => {
      onSaved(updated)
      toast.success(t('settings.logoUpdated'))
    },
    meta: { silentError: true },
    onError: (error) => setProblem(error.fieldErrors.logo?.join(' ') ?? error.message),
  })
  const remove = useMutation({
    mutationFn: removeLogo,
    onSuccess: (updated) => {
      onSaved(updated)
      toast.success(t('settings.logoRemoved'))
    },
  })

  function onFile(file: File | undefined) {
    if (!file) return
    if (!LOGO_TYPES.includes(file.type)) return setProblem(t('settings.logoType'))
    if (file.size > MAX_LOGO_BYTES) return setProblem(t('settings.logoSize'))
    upload.mutate(file)
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-surface-muted">
        {business.logo ? (
          <img
            src={business.logo}
            alt={t('settings.logoAlt', { business: business.name })}
            className="size-full object-contain p-2"
          />
        ) : (
          <Store className="size-9 text-ink-subtle" aria-hidden="true" />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm text-ink-muted">{t('settings.logoHint')}</p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={LOGO_TYPES.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              onFile(e.target.files?.[0])
              e.target.value = '' // allow choosing the same file again
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            loading={upload.isPending}
            leadingIcon={<ImageUp className="size-4" aria-hidden="true" />}
            onClick={() => inputRef.current?.click()}
          >
            {business.logo ? t('settings.replaceLogo') : t('settings.uploadLogo')}
          </Button>
          {business.logo && (
            <Button
              variant="ghost"
              size="sm"
              loading={remove.isPending}
              leadingIcon={<Trash2 className="size-4" aria-hidden="true" />}
              onClick={() => remove.mutate()}
            >
              {t('settings.removeLogo')}
            </Button>
          )}
        </div>
        {problem && (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        )}
      </div>
    </div>
  )
}

export function BusinessProfileCard({ business }: { business: Business }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      name: business.name,
      contact_email: business.contact_email,
      contact_phone: business.contact_phone,
      address: business.address,
    },
  })

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null)
    try {
      const changes = Object.fromEntries(
        FIELDS.filter((f) => dirtyFields[f]).map((f) => [f, data[f]]),
      )
      const updated = await updateBusiness(changes)
      queryClient.setQueryData(businessKeys.profile, updated)
      reset(data)
      toast.success(t('settings.saved'))
    } catch (error) {
      setFormError(applyServerErrors(error, setError, {}, FIELDS))
    }
  })

  return (
    <Card>
      <CardHeader title={t('settings.profileTitle')} description={t('settings.profileHint')} />
      <CardBody className="flex flex-col gap-6">
        <LogoUploader business={business} />
        {formError && <Alert tone="danger">{formError}</Alert>}
        <form onSubmit={(e) => void onSubmit(e)} noValidate className="grid gap-4 sm:grid-cols-2">
          <TextField
            className="sm:col-span-2"
            label={t('onboarding.businessName')}
            error={fieldMessage(t, errors.name?.message)}
            {...register('name')}
          />
          <TextField
            label={t('onboarding.contactEmail')}
            type="email"
            inputMode="email"
            error={fieldMessage(t, errors.contact_email?.message)}
            {...register('contact_email')}
          />
          <TextField
            label={t('onboarding.contactPhone')}
            type="tel"
            inputMode="tel"
            error={fieldMessage(t, errors.contact_phone?.message)}
            {...register('contact_phone')}
          />
          <TextAreaField
            className="sm:col-span-2"
            label={t('onboarding.address')}
            rows={2}
            error={fieldMessage(t, errors.address?.message)}
            {...register('address')}
          />
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
