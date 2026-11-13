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
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { applyServerErrors, fieldMessage } from '@/lib/forms'

import {
  createCategory,
  invalidateExpenses,
  updateCategory,
  type ExpenseCategory as Category,
} from './api'

const schema = z.object({
  name: z.string().trim().min(1, 'categories.nameRequired').max(100),
  description: z.string().trim().max(1000),
})
type FormValues = z.infer<typeof schema>

interface ExpenseCategoryDialogProps {
  open: boolean
  onClose: () => void
  category?: Category | null
}

export function ExpenseCategoryDialog({ open, onClose, category }: ExpenseCategoryDialogProps) {
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
    values: { name: category?.name ?? '', description: category?.description ?? '' },
  })

  function close() {
    reset()
    setFormError(null)
    onClose()
  }

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null)
    try {
      if (category) {
        await updateCategory(category.id, data)
        toast.success(t('categories.saved'))
      } else {
        await createCategory(data)
        toast.success(t('categories.created', { name: data.name }))
      }
      invalidateExpenses(queryClient)
      close()
    } catch (error) {
      setFormError(applyServerErrors(error, setError, {}, ['name', 'description']))
    }
  })

  const err = (field: keyof FormValues) => fieldMessage(t, errors[field]?.message)
  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!isSubmitting}
      title={
        category ? t('categories.editTitle', { name: category.name }) : t('categories.addTitle')
      }
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={isSubmitting}>
            {t('changePassword.cancel')}
          </Button>
          <Button
            type="submit"
            form="expense-category-form"
            loading={isSubmitting}
            disabled={Boolean(category) && !isDirty}
          >
            {category ? t('categories.save') : t('categories.add')}
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
        id="expense-category-form"
        onSubmit={(e) => void onSubmit(e)}
        noValidate
        className="flex flex-col gap-4"
      >
        <TextField
          label={t('categories.name')}
          hint={t('expenseCategories.nameHint')}
          autoComplete="off"
          error={err('name')}
          {...register('name')}
        />
        <TextAreaField
          label={t('categories.description')}
          rows={3}
          error={err('description')}
          {...register('description')}
        />
      </form>
    </Dialog>
  )
}
