import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/TextField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { applyServerErrors, fieldMessage } from '@/lib/forms'

import { createBranch, invalidateBranches, updateBranch, type Branch } from './api'

const schema = z.object({
  name: z.string().trim().min(1, 'onboarding.required').max(255),
  address: z.string().trim().max(500),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s().-]*$/, 'profile.phoneInvalid'),
})
type FormValues = z.infer<typeof schema>
const FIELDS = ['name', 'address', 'phone'] as const

interface BranchFormDialogProps {
  open: boolean
  onClose: () => void
  /** Edit this branch; omit to create a new one. */
  branch?: Branch | null
}

export function BranchFormDialog({ open, onClose, branch }: BranchFormDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      name: branch?.name ?? '',
      address: branch?.address ?? '',
      phone: branch?.phone ?? '',
    },
  })

  function close() {
    reset()
    setFormError(null)
    onClose()
  }

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null)
    try {
      if (branch) {
        await updateBranch(branch.id, data)
        toast.success(t('branches.saved'))
      } else {
        await createBranch({ ...data, is_active: true })
        toast.success(t('branches.created', { name: data.name }))
      }
      invalidateBranches(queryClient)
      close()
    } catch (error) {
      setFormError(applyServerErrors(error, setError, {}, FIELDS))
    }
  })

  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!isSubmitting}
      title={branch ? t('branches.editTitle', { name: branch.name }) : t('branches.addTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={isSubmitting}>
            {t('changePassword.cancel')}
          </Button>
          <Button
            type="submit"
            form="branch-form"
            loading={isSubmitting}
            disabled={Boolean(branch) && !isDirty}
          >
            {branch ? t('branches.save') : t('branches.add')}
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
        id="branch-form"
        onSubmit={(e) => void onSubmit(e)}
        noValidate
        className="flex flex-col gap-4"
      >
        <TextField
          label={t('branches.name')}
          hint={t('onboarding.branchNameHint')}
          error={fieldMessage(t, errors.name?.message)}
          {...register('name')}
        />
        <TextAreaField
          label={t('branches.address')}
          rows={2}
          error={fieldMessage(t, errors.address?.message)}
          {...register('address')}
        />
        <TextField
          label={t('branches.phone')}
          type="tel"
          inputMode="tel"
          error={fieldMessage(t, errors.phone?.message)}
          {...register('phone')}
        />
      </form>
    </Dialog>
  )
}
