import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField } from '@/components/ui/SelectField'
import { PasswordField, TextField } from '@/components/ui/TextField'
import { PasswordRequirements } from '@/features/auth/PasswordRequirements'
import { checkPassword, passwordIsAcceptable } from '@/features/auth/passwordRules'
import { assignableRoles, type Role } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/auth/useAuth'
import { invalidateBranches } from '@/features/branches/api'
import type { Branch } from '@/features/business/api'
import { applyServerErrors, fieldMessage } from '@/lib/forms'
import { displayName } from '@/lib/names'

import { createStaff, staffKeys, updateStaff, type StaffMember } from './api'

type FormValues = {
  first_name: string
  last_name: string
  username: string
  email: string
  phone: string
  role: Role
  branch_ids: number[]
  password: string
  confirm: string
}
const ALL_ROLES = [
  'owner',
  'admin',
  'branch_manager',
  'cashier',
  'inventory_manager',
  'accountant',
] as const satisfies readonly Role[]

const FIELDS = [
  'first_name',
  'last_name',
  'username',
  'email',
  'phone',
  'role',
  'branch_ids',
  'password',
] as const

function buildSchema(isNew: boolean) {
  return z
    .object({
      first_name: z.string().trim().max(150),
      last_name: z.string().trim().max(150),
      username: z.string().trim().max(150),
      email: z.union([z.literal(''), z.email('onboarding.emailInvalid')]),
      phone: z
        .string()
        .trim()
        .max(30)
        .regex(/^[+\d\s().-]*$/, 'profile.phoneInvalid'),
      role: z.enum(ALL_ROLES),
      branch_ids: z.array(z.number()),
      password: z.string(),
      confirm: z.string(),
    })
    .superRefine((v, ctx) => {
      // Everyone except accountants works at specific branches.
      if (v.role !== 'accountant' && v.branch_ids.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['branch_ids'], message: 'staff.branchesRequired' })
      }
      if (!isNew) return
      if (!v.username) {
        ctx.addIssue({ code: 'custom', path: ['username'], message: 'onboarding.required' })
      } else if (!/^[\w.@+-]+$/.test(v.username)) {
        ctx.addIssue({ code: 'custom', path: ['username'], message: 'onboarding.usernameInvalid' })
      }
      const personal = [v.username, v.first_name, v.last_name, v.email]
      if (!passwordIsAcceptable(checkPassword(v.password, { personal }))) {
        ctx.addIssue({ code: 'custom', path: ['password'], message: 'password.newInvalid' })
      }
      if (v.password !== v.confirm) {
        ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'password.mismatch' })
      }
    })
}

interface StaffFormDialogProps {
  open: boolean
  onClose: () => void
  /** Edit this person; omit to add someone new. */
  member?: StaffMember | null
  /** Branches the signed-in user may assign (their own, for a branch manager). */
  branches: Branch[]
}

export function StaffFormDialog({ open, onClose, member, branches }: StaffFormDialogProps) {
  const { t } = useTranslation()
  const actor = useCurrentUser()
  const queryClient = useQueryClient()
  const branchesId = useId()
  const isNew = !member
  const roles = assignableRoles(actor)
  const [formError, setFormError] = useState<string | null>(null)

  const assignable = new Set(branches.map((b) => b.id))
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(buildSchema(isNew)),
    values: {
      first_name: member?.first_name ?? '',
      last_name: member?.last_name ?? '',
      username: member?.username ?? '',
      email: member?.email ?? '',
      phone: member?.phone ?? '',
      role: member?.role ?? (roles.includes('cashier') ? 'cashier' : (roles[0] ?? 'cashier')),
      // A branch manager only sees (and changes) assignments to their own branches.
      branch_ids: (member?.branch_ids ?? (branches.length === 1 ? [branches[0]!.id] : [])).filter(
        (id) => assignable.has(id),
      ),
      password: '',
      confirm: '',
    },
  })
  const [role, password, username, firstName, lastName, email] = useWatch({
    control,
    name: ['role', 'password', 'username', 'first_name', 'last_name', 'email'],
  })

  function close() {
    reset()
    setFormError(null)
    onClose()
  }

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null)
    try {
      if (member) {
        const changes = Object.fromEntries(
          (['first_name', 'last_name', 'email', 'phone', 'role', 'branch_ids'] as const)
            .filter((f) => dirtyFields[f])
            .map((f) => [f, data[f]]),
        )
        await updateStaff(member.id, changes)
        toast.success(t('staff.saved'))
      } else {
        const { confirm: _confirm, ...input } = data
        await createStaff(input)
        toast.success(t('staff.created', { name: displayName(data) }))
      }
      void queryClient.invalidateQueries({ queryKey: staffKeys.all })
      invalidateBranches(queryClient) // staff counts and managers changed
      close()
    } catch (error) {
      setFormError(applyServerErrors(error, setError, {}, FIELDS))
    }
  })

  const err = (field: keyof FormValues) => fieldMessage(t, errors[field]?.message)
  const passwordProps = { showLabel: t('auth.showPassword'), hideLabel: t('auth.hidePassword') }

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      dismissible={!isSubmitting}
      title={member ? t('staff.editTitle', { name: displayName(member) }) : t('staff.addTitle')}
      description={actor.role === 'branch_manager' ? t('staff.managerScope') : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={isSubmitting}>
            {t('changePassword.cancel')}
          </Button>
          <Button
            type="submit"
            form="staff-form"
            loading={isSubmitting}
            disabled={!isNew && !isDirty}
          >
            {isNew ? t('staff.create') : t('staff.save')}
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
        id="staff-form"
        onSubmit={(e) => void onSubmit(e)}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        <TextField
          label={t('profile.firstName')}
          error={err('first_name')}
          {...register('first_name')}
        />
        <TextField
          label={t('profile.lastName')}
          error={err('last_name')}
          {...register('last_name')}
        />
        {isNew && (
          <TextField
            label={t('staff.username')}
            hint={t('staff.usernameHint')}
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
            error={err('username')}
            {...register('username')}
          />
        )}
        <SelectField label={t('staff.role')} error={err('role')} {...register('role')}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t('staff.email')}
          hint={t('staff.emailHint')}
          type="email"
          inputMode="email"
          autoComplete="off"
          error={err('email')}
          {...register('email')}
        />
        <TextField
          label={t('staff.phone')}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          error={err('phone')}
          {...register('phone')}
        />

        <Controller
          control={control}
          name="branch_ids"
          render={({ field }) => (
            <fieldset
              className="sm:col-span-2"
              aria-describedby={`${branchesId}-hint`}
              aria-invalid={errors.branch_ids ? true : undefined}
            >
              <legend className="text-sm font-medium text-ink">{t('staff.branches')}</legend>
              <p id={`${branchesId}-hint`} className="mt-0.5 text-sm text-ink-muted">
                {role === 'accountant'
                  ? t('staff.branchesAccountantHint')
                  : t('staff.branchesHint')}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {branches.map((branch) => {
                  const checked = field.value.includes(branch.id)
                  return (
                    <label
                      key={branch.id}
                      className="flex cursor-pointer items-center gap-3 rounded-control border border-border px-3.5 py-2.5 text-sm text-ink has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          field.onChange(
                            checked
                              ? field.value.filter((id) => id !== branch.id)
                              : [...field.value, branch.id],
                          )
                        }
                        className="size-4 accent-primary"
                      />
                      {branch.name}
                    </label>
                  )
                })}
              </div>
              {errors.branch_ids && (
                <p className="mt-1.5 text-sm text-danger">{err('branch_ids')}</p>
              )}
            </fieldset>
          )}
        />

        {isNew && (
          <>
            <div className="flex flex-col gap-3">
              <PasswordField
                label={t('staff.initialPassword')}
                autoComplete="new-password"
                aria-describedby="staff-password-rules"
                error={err('password')}
                {...passwordProps}
                {...register('password')}
              />
              <PasswordRequirements
                id="staff-password-rules"
                results={checkPassword(password, {
                  personal: [username, firstName, lastName, email],
                })}
              />
            </div>
            <PasswordField
              label={t('password.confirmPlain')}
              autoComplete="new-password"
              error={err('confirm')}
              {...passwordProps}
              {...register('confirm')}
            />
            <p className="text-sm text-ink-muted sm:col-span-2">{t('staff.initialPasswordHint')}</p>
          </>
        )}
      </form>
    </Dialog>
  )
}
