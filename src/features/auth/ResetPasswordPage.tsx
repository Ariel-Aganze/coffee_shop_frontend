import { zodResolver } from '@hookform/resolvers/zod'
import { CircleCheck, LinkIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { z } from 'zod'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PasswordField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api/errors'
import { applyServerErrors, fieldMessage } from '@/lib/forms'

import { confirmPasswordReset } from './api'
import { AuthLayout } from './AuthLayout'
import { PasswordRequirements } from './PasswordRequirements'
import { checkPassword, passwordIsAcceptable } from './passwordRules'
import { useAuth } from './useAuth'

const schema = z
  .object({ password: z.string(), confirm: z.string() })
  .refine((v) => passwordIsAcceptable(checkPassword(v.password)), {
    path: ['password'],
    message: 'password.newInvalid',
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'password.mismatch' })
type FormValues = z.infer<typeof schema>

type State = 'form' | 'done' | 'invalid'

const linkClass =
  'inline-flex h-11 items-center justify-center rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover'

/** Step 2 of password reset: the page the emailed link opens (/reset-password?uid=…&token=…). */
export function ResetPasswordPage() {
  const { t } = useTranslation()
  const { status, logout } = useAuth()
  const [params] = useSearchParams()
  const uid = params.get('uid') ?? ''
  const token = params.get('token') ?? ''
  const [state, setState] = useState<State>(uid && token ? 'form' : 'invalid')
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  })
  const password = useWatch({ control, name: 'password' })

  // A reset signs out every device; if this browser was signed in, follow suit.
  useEffect(() => {
    if (state === 'done' && status === 'authenticated') void logout()
  }, [state, status, logout])

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await confirmPasswordReset({ uid, token, new_password: values.password })
      setState('done')
    } catch (error) {
      if (error instanceof ApiError && (error.fieldErrors.token || error.fieldErrors.uid)) {
        setState('invalid')
        return
      }
      setFormError(applyServerErrors(error, setError, { new_password: 'password' }))
    }
  })

  if (state === 'invalid') {
    return (
      <AuthLayout title={t('reset.invalidTitle')} focusTitle>
        <div className="mt-6 flex flex-col items-center text-center">
          <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-peach text-primary">
            <LinkIcon className="size-7" aria-hidden="true" />
          </span>
          <p className="text-sm text-ink-muted">{t('reset.invalidBody')}</p>
          <Link to="/forgot-password" className={`${linkClass} mt-6`}>
            {t('reset.requestNew')}
          </Link>
        </div>
      </AuthLayout>
    )
  }

  if (state === 'done') {
    return (
      <AuthLayout title={t('reset.doneTitle')} focusTitle>
        <div className="mt-6 flex flex-col items-center text-center">
          <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-success-soft text-success">
            <CircleCheck className="size-7" aria-hidden="true" />
          </span>
          <p className="text-sm text-ink-muted">{t('reset.doneBody')}</p>
          <Link to="/login" className={`${linkClass} mt-6`}>
            {t('auth.signIn')}
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('reset.title')} subtitle={t('reset.subtitle')}>
      {formError && (
        <Alert tone="danger" className="mt-5">
          {formError}
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <PasswordField
          label={t('password.new')}
          autoComplete="new-password"
          showLabel={t('auth.showPassword')}
          hideLabel={t('auth.hidePassword')}
          aria-describedby="reset-requirements"
          error={fieldMessage(t, errors.password?.message)}
          {...register('password')}
        />
        <div>
          <PasswordRequirements id="reset-requirements" results={checkPassword(password)} />
          <p className="mt-1.5 text-xs text-ink-muted">{t('password.commonNote')}</p>
        </div>
        <PasswordField
          label={t('password.confirm')}
          autoComplete="new-password"
          showLabel={t('auth.showPassword')}
          hideLabel={t('auth.hidePassword')}
          error={fieldMessage(t, errors.confirm?.message)}
          {...register('confirm')}
        />
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          {t('reset.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
