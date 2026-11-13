import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { TextField } from '@/components/ui/TextField'
import { meQueryKey, updateProfile, type ProfileInput } from '@/features/auth/api'
import { hasBusinessWideAccess, ROLE_LABELS } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useBusiness } from '@/features/business/useBusiness'
import { applyServerErrors, fieldMessage } from '@/lib/forms'
import { displayName } from '@/lib/names'

const schema = z.object({
  first_name: z.string().trim().max(150),
  last_name: z.string().trim().max(150),
  email: z.union([z.literal(''), z.email('forgot.emailInvalid')]),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s().-]*$/, 'profile.phoneInvalid'),
})
type FormValues = z.infer<typeof schema>
const FIELDS = ['first_name', 'last_name', 'email', 'phone'] as const

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-sm font-medium text-ink sm:text-right">{children}</dd>
    </div>
  )
}

/** The signed-in user's own account: summary, editable contact details, security. */
export function ProfilePage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const { branches, format } = useBusiness()
  const [formError, setFormError] = useState<string | null>(null)

  const values: FormValues = {
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone,
  }
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<FormValues>({ resolver: zodResolver(schema), values })

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null)
    const changes: ProfileInput = Object.fromEntries(
      FIELDS.filter((f) => dirtyFields[f]).map((f) => [f, data[f]]),
    )
    try {
      const updated = await updateProfile(changes)
      queryClient.setQueryData(meQueryKey, updated)
      reset({
        first_name: updated.first_name,
        last_name: updated.last_name,
        email: updated.email,
        phone: updated.phone,
      })
      toast.success(t('profile.saved'))
    } catch (error) {
      setFormError(applyServerErrors(error, setError, {}, FIELDS))
    }
  })

  const name = displayName(user)
  const branchNames = hasBusinessWideAccess(user)
    ? t('profile.allBranches')
    : branches
        .filter((b) => user.branch_ids.includes(b.id))
        .map((b) => b.name)
        .join(', ') || t('profile.noBranches')

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-4 sm:gap-6">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <Avatar name={name} className="size-16 text-xl" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-ink">{name}</p>
              <Badge tone="brand" className="mt-1">
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>
          </div>
          <dl className="mt-4 divide-y divide-border">
            <Row label={t('profile.username')}>{user.username}</Row>
            <Row label={t('profile.branches')}>{branchNames}</Row>
            <Row label={t('profile.memberSince')}>{format.date(user.date_joined)}</Row>
          </dl>
        </Card>

        <Card>
          <CardHeader title={t('profile.security')} description={t('profile.securityBody')} />
          <CardBody>
            <Link
              to="/profile/password"
              className="inline-flex h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              <KeyRound className="size-4" aria-hidden="true" />
              {t('profile.changePassword')}
            </Link>
          </CardBody>
        </Card>
      </div>

      <Card className="lg:col-span-2">
        <CardHeader
          title={t('profile.personalDetails')}
          description={t('profile.personalDetailsHint')}
        />
        <CardBody>
          {formError && (
            <Alert tone="danger" className="mb-5">
              {formError}
            </Alert>
          )}
          <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('profile.firstName')}
              autoComplete="given-name"
              error={fieldMessage(t, errors.first_name?.message)}
              {...register('first_name')}
            />
            <TextField
              label={t('profile.lastName')}
              autoComplete="family-name"
              error={fieldMessage(t, errors.last_name?.message)}
              {...register('last_name')}
            />
            <TextField
              label={t('profile.email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              hint={t('profile.emailHint')}
              error={fieldMessage(t, errors.email?.message)}
              {...register('email')}
            />
            <TextField
              label={t('profile.phone')}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              error={fieldMessage(t, errors.phone?.message)}
              {...register('phone')}
            />
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
                {t('profile.save')}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
