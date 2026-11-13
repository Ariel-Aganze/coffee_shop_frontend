/**
 * Business onboarding wizard (SRS workflow 12.1): business → owner account →
 * currency & region → first branch → review. One request creates everything;
 * the owner is then signed in.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Pencil } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Controller, get, useForm, useWatch, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PasswordField, TextField } from '@/components/ui/TextField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { PasswordRequirements } from '@/features/auth/PasswordRequirements'
import { checkPassword } from '@/features/auth/passwordRules'
import { useAuth } from '@/features/auth/useAuth'
import { registerBusiness } from '@/features/business/api'
import { CurrencyPicker } from '@/features/settings/CurrencyPicker'
import {
  browserTimezone,
  datePreview,
  numberPreview,
  timezoneLabel,
} from '@/features/settings/regional'
import {
  DateFormatField,
  LanguageField,
  NumberFormatField,
  TimezoneField,
} from '@/features/settings/RegionalFields'
import { ApiError } from '@/lib/api/errors'
import { applyServerErrors, fieldMessage } from '@/lib/forms'

import { StepIndicator } from './StepIndicator'
import { ALL_FIELDS, registrationSchema, STEPS, type RegistrationForm } from './schema'

const DEFAULTS: RegistrationForm = {
  business: { name: '', contact_email: '', contact_phone: '', address: '' },
  owner: { first_name: '', last_name: '', username: '', email: '', password: '', confirm: '' },
  settings: {
    currency_code: '',
    language: 'en',
    timezone: browserTimezone(),
    date_format: 'DD/MM/YYYY',
    number_format: '1,234.56',
  },
  first_branch: { name: '', address: '', phone: '' },
}

function stepOfField(field: string): number {
  const index = STEPS.findIndex((s) => (s.fields as readonly string[]).includes(field))
  return index === -1 ? STEPS.length - 1 : index
}

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [view, setView] = useState({ step: 0, focus: false })
  const { step } = view
  const [formError, setFormError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: DEFAULTS,
    mode: 'onTouched',
  })
  const {
    register,
    control,
    trigger,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form
  const values = useWatch({ control }) as RegistrationForm
  const current = STEPS[step]!

  // After moving between steps, put focus on the new step's heading so
  // keyboard and screen-reader users land at the start of it.
  useEffect(() => {
    if (view.focus) headingRef.current?.focus()
  }, [view])
  const goTo = (index: number) =>
    setView({ step: Math.max(0, Math.min(index, STEPS.length - 1)), focus: true })

  async function next() {
    const valid = await trigger(current.fields as unknown as FieldPath<RegistrationForm>[], {
      shouldFocus: true,
    })
    if (valid) goTo(step + 1)
  }

  const onSubmit = handleSubmit(
    async (data) => {
      setFormError(null)
      const { confirm: _confirm, ...owner } = data.owner
      try {
        await registerBusiness({ ...data, owner })
      } catch (error) {
        const banner = applyServerErrors(
          error,
          setError,
          {},
          ALL_FIELDS as unknown as FieldPath<RegistrationForm>[],
        )
        if (error instanceof ApiError) {
          const firstField = Object.keys(error.fieldErrors)[0]
          if (firstField) goTo(stepOfField(firstField))
        }
        setFormError(banner)
        return
      }
      try {
        await login({ username: owner.username, password: owner.password })
        toast.success(t('onboarding.welcome', { business: data.business.name }))
        navigate('/dashboard', { replace: true })
      } catch {
        // Created, but signing in failed (e.g. network): send them to sign in.
        navigate('/login', { replace: true })
      }
    },
    (invalid) => {
      // Validation failed on submit: go to the first step with a problem.
      const failing = ALL_FIELDS.find((field) => get(invalid, field))
      if (failing) goTo(stepOfField(failing))
    },
  )

  /** Error message for a nested field path such as 'owner.username'. */
  const err = (path: string) =>
    fieldMessage(t, (get(errors, path) as { message?: string } | undefined)?.message)

  const passwordProps = { showLabel: t('auth.showPassword'), hideLabel: t('auth.hidePassword') }

  return (
    <AuthLayout
      width="lg"
      title={t('onboarding.title')}
      subtitle={t('onboarding.subtitle')}
      footer={
        <p className="text-sm text-ink-muted">
          {t('onboarding.haveAccount')}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t('auth.signIn')}
          </Link>
        </p>
      }
    >
      <StepIndicator current={step} className="mt-6" />

      <form onSubmit={(e) => void onSubmit(e)} noValidate className="mt-6">
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-ink outline-none">
          {t(`onboarding.steps.${current.key}.title`)}
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">{t(`onboarding.steps.${current.key}.hint`)}</p>

        {formError && (
          <Alert tone="danger" className="mt-4">
            {formError}
          </Alert>
        )}

        <div className="mt-5">
          {current.key === 'business' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                className="sm:col-span-2"
                label={t('onboarding.businessName')}
                autoComplete="organization"
                error={err('business.name')}
                {...register('business.name')}
              />
              <TextField
                label={t('onboarding.contactEmail')}
                type="email"
                inputMode="email"
                autoComplete="email"
                error={err('business.contact_email')}
                {...register('business.contact_email')}
              />
              <TextField
                label={t('onboarding.contactPhone')}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                error={err('business.contact_phone')}
                {...register('business.contact_phone')}
              />
              <TextAreaField
                className="sm:col-span-2"
                label={t('onboarding.address')}
                rows={2}
                autoComplete="street-address"
                error={err('business.address')}
                {...register('business.address')}
              />
            </div>
          )}

          {current.key === 'owner' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={t('profile.firstName')}
                autoComplete="given-name"
                error={err('owner.first_name')}
                {...register('owner.first_name')}
              />
              <TextField
                label={t('profile.lastName')}
                autoComplete="family-name"
                error={err('owner.last_name')}
                {...register('owner.last_name')}
              />
              <TextField
                label={t('auth.username')}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                hint={t('onboarding.usernameHint')}
                error={err('owner.username')}
                {...register('owner.username')}
              />
              <TextField
                label={t('profile.email')}
                type="email"
                inputMode="email"
                autoComplete="email"
                hint={t('profile.emailHint')}
                error={err('owner.email')}
                {...register('owner.email')}
              />
              {/* Checklist right under the password it describes (also on phones). */}
              <div className="flex flex-col gap-3">
                <PasswordField
                  label={t('auth.password')}
                  autoComplete="new-password"
                  aria-describedby="owner-password-rules"
                  error={err('owner.password')}
                  {...passwordProps}
                  {...register('owner.password')}
                />
                <div>
                  <PasswordRequirements
                    id="owner-password-rules"
                    results={checkPassword(values.owner?.password ?? '', {
                      personal: [
                        values.owner?.username,
                        values.owner?.first_name,
                        values.owner?.last_name,
                        values.owner?.email,
                      ],
                    })}
                  />
                  <p className="mt-1.5 text-xs text-ink-muted">{t('password.commonNote')}</p>
                </div>
              </div>
              <PasswordField
                label={t('password.confirmPlain')}
                autoComplete="new-password"
                error={err('owner.confirm')}
                {...passwordProps}
                {...register('owner.confirm')}
              />
            </div>
          )}

          {current.key === 'region' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Controller
                  control={control}
                  name="settings.currency_code"
                  render={({ field }) => (
                    <CurrencyPicker
                      legend={t('onboarding.currency')}
                      value={field.value}
                      onChange={field.onChange}
                      error={err('settings.currency_code')}
                    />
                  )}
                />
                <p className="mt-2 text-sm text-ink-muted">{t('onboarding.currencyHint')}</p>
              </div>
              <TimezoneField error={err('settings.timezone')} {...register('settings.timezone')} />
              <LanguageField error={err('settings.language')} {...register('settings.language')} />
              <DateFormatField
                error={err('settings.date_format')}
                {...register('settings.date_format')}
              />
              <NumberFormatField
                error={err('settings.number_format')}
                {...register('settings.number_format')}
              />
            </div>
          )}

          {current.key === 'branch' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                className="sm:col-span-2"
                label={t('onboarding.branchName')}
                hint={t('onboarding.branchNameHint')}
                error={err('first_branch.name')}
                {...register('first_branch.name')}
              />
              <TextAreaField
                label={t('onboarding.address')}
                rows={2}
                error={err('first_branch.address')}
                {...register('first_branch.address')}
              />
              <TextField
                label={t('onboarding.contactPhone')}
                type="tel"
                inputMode="tel"
                error={err('first_branch.phone')}
                {...register('first_branch.phone')}
              />
            </div>
          )}

          {current.key === 'review' && <Review values={values} onEdit={goTo} />}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <Button
              variant="ghost"
              leadingIcon={<ArrowLeft className="size-4" aria-hidden="true" />}
              onClick={() => goTo(step - 1)}
              disabled={isSubmitting}
            >
              {t('onboarding.back')}
            </Button>
          ) : (
            <span />
          )}
          {current.key === 'review' ? (
            <Button type="submit" size="lg" loading={isSubmitting}>
              {t('onboarding.create')}
            </Button>
          ) : (
            <Button onClick={() => void next()} size="lg">
              {t('onboarding.next')}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </form>
    </AuthLayout>
  )
}

function Review({ values, onEdit }: { values: RegistrationForm; onEdit: (step: number) => void }) {
  const { t } = useTranslation()
  const sections: { step: number; title: string; rows: [string, ReactNode][] }[] = [
    {
      step: 0,
      title: t('onboarding.steps.business.title'),
      rows: [
        [t('onboarding.businessName'), values.business.name],
        [t('onboarding.contactEmail'), values.business.contact_email || '—'],
        [t('onboarding.contactPhone'), values.business.contact_phone || '—'],
      ],
    },
    {
      step: 1,
      title: t('onboarding.steps.owner.title'),
      rows: [
        [
          t('onboarding.ownerName'),
          `${values.owner.first_name} ${values.owner.last_name}`.trim() || '—',
        ],
        [t('auth.username'), values.owner.username],
        [t('profile.email'), values.owner.email],
      ],
    },
    {
      step: 2,
      title: t('onboarding.steps.region.title'),
      rows: [
        [t('onboarding.currency'), <strong key="c">{values.settings.currency_code}</strong>],
        [
          t('regional.timezone'),
          timezoneLabel(values.settings.timezone) || values.settings.timezone,
        ],
        [t('regional.dateFormat'), datePreview(values.settings.date_format)],
        [t('regional.numberFormat'), numberPreview(values.settings.number_format)],
      ],
    },
    {
      step: 3,
      title: t('onboarding.steps.branch.title'),
      rows: [[t('onboarding.branchName'), values.first_branch.name]],
    },
  ]
  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <section key={section.step} className="rounded-control border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-ink">{section.title}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(section.step)}
              leadingIcon={<Pencil className="size-3.5" aria-hidden="true" />}
              aria-label={t('onboarding.editSection', { section: section.title })}
            >
              {t('onboarding.edit')}
            </Button>
          </div>
          <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[10rem_1fr]">
            {section.rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-ink-muted">{label}</dt>
                <dd className="break-words text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
