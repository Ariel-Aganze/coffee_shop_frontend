import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, Info } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'

import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { PasswordField, TextField } from '@/components/ui/TextField'
import { ApiError, getErrorMessage } from '@/lib/api/errors'

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
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo className="h-16 sm:h-20" />
        </div>

        <div className="rounded-card border border-border bg-surface p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t('auth.signInTitle')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{t('auth.signInSubtitle')}</p>

          {notice && !formError && (
            <p className="mt-5 flex items-start gap-2 rounded-xl bg-info-soft px-3.5 py-3 text-sm text-info">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {notice}
            </p>
          )}
          {formError && (
            <p
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {formError}
            </p>
          )}

          <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
            <TextField
              label={t('auth.username')}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              error={
                errors.username?.message && t(errors.username.message as 'auth.usernameRequired')
              }
              {...register('username')}
            />
            <PasswordField
              label={t('auth.password')}
              autoComplete="current-password"
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
              error={
                errors.password?.message && t(errors.password.message as 'auth.passwordRequired')
              }
              {...register('password')}
            />
            <div className="-mt-1 flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-primary hover:underline"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>
            <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
              {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
