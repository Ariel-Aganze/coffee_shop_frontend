import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { z } from 'zod'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { applyServerErrors, fieldMessage } from '@/lib/forms'

import { requestPasswordReset } from './api'
import { AuthLayout } from './AuthLayout'

const schema = z.object({ email: z.email('forgot.emailInvalid') })
type FormValues = z.infer<typeof schema>

function BackToSignIn() {
  const { t } = useTranslation()
  return (
    <Link
      to="/login"
      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t('forgot.backToSignIn')}
    </Link>
  )
}

/**
 * Step 1 of password reset (AUTH-004). The confirmation is identical whether
 * or not the email exists, so this page can't be used to discover accounts.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null)
    try {
      await requestPasswordReset(email)
      setSentTo(email)
    } catch (error) {
      setFormError(applyServerErrors(error, setError, {}, ['email']))
    }
  })

  if (sentTo) {
    return (
      <AuthLayout title={t('forgot.sentTitle')} focusTitle footer={<BackToSignIn />}>
        <div className="mt-6 flex flex-col items-center text-center">
          <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-success-soft text-success">
            <MailCheck className="size-7" aria-hidden="true" />
          </span>
          <p className="text-sm text-ink-muted">{t('forgot.sentBody', { email: sentTo })}</p>
          <Button
            variant="secondary"
            className="mt-6"
            onClick={() => {
              setSentTo(null)
              reset()
            }}
          >
            {t('forgot.tryAgain')}
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('forgot.title')} subtitle={t('forgot.subtitle')} footer={<BackToSignIn />}>
      {formError && (
        <Alert tone="danger" className="mt-5">
          {formError}
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <TextField
          label={t('forgot.email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          hint={t('forgot.noEmailHint')}
          error={fieldMessage(t, errors.email?.message)}
          {...register('email')}
        />
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          {t('forgot.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
