import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PasswordField } from '@/components/ui/TextField'
import { changePassword } from '@/features/auth/api'
import { PasswordRequirements } from '@/features/auth/PasswordRequirements'
import { checkPassword, passwordIsAcceptable } from '@/features/auth/passwordRules'
import { useCurrentUser } from '@/features/auth/useAuth'
import { applyServerErrors, fieldMessage } from '@/lib/forms'

type FormValues = { currentPassword: string; newPassword: string; confirm: string }

/** AUTH-003: change your own password; other devices are signed out. */
export function ChangePasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const [formError, setFormError] = useState<string | null>(null)
  const personal = [user.username, user.first_name, user.last_name, user.email]

  const schema = z
    .object({
      currentPassword: z.string().min(1, 'password.currentRequired'),
      newPassword: z.string(),
      confirm: z.string(),
    })
    .refine(
      (v) =>
        passwordIsAcceptable(
          checkPassword(v.newPassword, { personal, current: v.currentPassword }),
        ),
      { path: ['newPassword'], message: 'password.newInvalid' },
    )
    .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'password.mismatch' })

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  })
  const [currentPassword, newPassword] = useWatch({
    control,
    name: ['currentPassword', 'newPassword'],
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await changePassword({
        old_password: values.currentPassword,
        new_password: values.newPassword,
      })
      toast.success(t('changePassword.success'))
      navigate('/profile')
    } catch (error) {
      setFormError(
        applyServerErrors(error, setError, {
          old_password: 'currentPassword',
          new_password: 'newPassword',
        }),
      )
    }
  })

  const passwordProps = { showLabel: t('auth.showPassword'), hideLabel: t('auth.hidePassword') }

  return (
    <Card className="mx-auto w-full max-w-xl p-5 sm:p-8">
      <p className="text-sm text-ink-muted">{t('changePassword.subtitle')}</p>
      {formError && (
        <Alert tone="danger" className="mt-5">
          {formError}
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <PasswordField
          label={t('password.current')}
          autoComplete="current-password"
          error={fieldMessage(t, errors.currentPassword?.message)}
          {...passwordProps}
          {...register('currentPassword')}
        />
        <PasswordField
          label={t('password.new')}
          autoComplete="new-password"
          aria-describedby="change-requirements"
          error={fieldMessage(t, errors.newPassword?.message)}
          {...passwordProps}
          {...register('newPassword')}
        />
        <div>
          <PasswordRequirements
            id="change-requirements"
            results={checkPassword(newPassword, { personal, current: currentPassword })}
          />
          <p className="mt-1.5 text-xs text-ink-muted">{t('password.commonNote')}</p>
        </div>
        <PasswordField
          label={t('password.confirm')}
          autoComplete="new-password"
          error={fieldMessage(t, errors.confirm?.message)}
          {...passwordProps}
          {...register('confirm')}
        />
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link
            to="/profile"
            className="inline-flex h-11 items-center justify-center rounded-control px-4 text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            {t('changePassword.cancel')}
          </Link>
          <Button type="submit" loading={isSubmitting}>
            {t('changePassword.submit')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
