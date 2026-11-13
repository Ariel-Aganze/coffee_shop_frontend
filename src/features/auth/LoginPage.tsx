import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PasswordField, TextField } from '@/components/ui/TextField'
import { ApiError, getErrorMessage } from '@/lib/api/errors'
import { fieldMessage } from '@/lib/forms'

import { AuthLayout } from './AuthLayout'
import { useAuth } from './useAuth'
import { homePathFor } from './permissions'
import { safeNextPath } from './redirects'

const schema = z.object({
  username: z.string().trim().min(1, 'auth.usernameRequired'),
  password: z.string().min(1, 'auth.passwordRequired'),
})
type FormValues = z.infer<typeof schema>

function loginErrorMessage(error: unknown, t: ReturnType<typeof useTranslation>['t']): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return t('auth.invalidCredentials')
    if (error.status === 403) return t('auth.accountDeactivated')
  }
  return getErrorMessage(error)
}

export function LoginPage() {
  const { t } = useTranslation()
  const { login, signOutReason } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const user = await login(values)
      navigate(safeNextPath(location.search) ?? homePathFor(user.role), { replace: true })
    } catch (error) {
      setFormError(loginErrorMessage(error, t))
    }
  })

  const notice =
    signOutReason === 'expired'
      ? t('auth.sessionExpired')
      : signOutReason
        ? t('auth.signedOut')
        : null

  return (
    <AuthLayout
      title={t('auth.signInTitle')}
      subtitle={t('auth.signInSubtitle')}
      footer={
        <p className="text-sm text-ink-muted">
          {t('onboarding.newHere')}{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            {t('onboarding.registerLink')}
          </Link>
        </p>
      }
    >
      {notice && !formError && (
        <Alert tone="info" className="mt-5">
          {notice}
        </Alert>
      )}
      {formError && (
        <Alert tone="danger" className="mt-5">
          {formError}
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <TextField
          label={t('auth.username')}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          error={fieldMessage(t, errors.username?.message)}
          {...register('username')}
        />
        <PasswordField
          label={t('auth.password')}
          autoComplete="current-password"
          showLabel={t('auth.showPassword')}
          hideLabel={t('auth.hidePassword')}
          error={fieldMessage(t, errors.password?.message)}
          {...register('password')}
        />
        <div className="-mt-1 flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            {t('auth.forgotPassword')}
          </Link>
        </div>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </form>
    </AuthLayout>
  )
}
