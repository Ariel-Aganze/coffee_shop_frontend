import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Paperclip, Trash2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField } from '@/components/ui/SelectField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useBusiness } from '@/features/business/useBusiness'
import { amountSchema, toInputAmount } from '@/lib/amount'
import { ApiError } from '@/lib/api/errors'
import { applyServerErrors, fieldMessage } from '@/lib/forms'

import {
  ATTACHMENT_TYPES,
  canFileCentral,
  createExpense,
  expenseKeys,
  fetchCategoryOptions,
  invalidateExpenses,
  MAX_ATTACHMENT_BYTES,
  updateExpense,
  type Expense,
} from './api'

const FIELDS = ['category', 'amount', 'description', 'branch', 'expense_date'] as const
const CENTRAL = 'central'

function buildSchema(decimals: number, today: string) {
  return z.object({
    category: z.string().min(1, 'expenses.categoryRequired'),
    amount: amountSchema(decimals),
    description: z.string().trim().min(1, 'expenses.descriptionRequired').max(2000),
    branch: z.string().min(1, 'expenses.branchRequired'),
    expense_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'expenses.dateRequired')
      .refine((d) => d <= today, 'expenses.dateFuture'),
  })
}
type FormInput = z.input<ReturnType<typeof buildSchema>>
type FormOutput = z.output<ReturnType<typeof buildSchema>>

interface ExpenseFormDialogProps {
  open: boolean
  onClose: () => void
  /** Correct this pending expense; omit to record a new one. */
  expense?: Expense | null
}

/** Record or correct an expense (SRS 12.3 workflow, EXP-002..EXP-007). */
export function ExpenseFormDialog({ open, onClose, expense }: ExpenseFormDialogProps) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { branches, branchId, format } = useBusiness()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const today = format.today()
  const central = canFileCentral(user)
  const [formError, setFormError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [removeFile, setRemoveFile] = useState(false)
  const [fileError, setFileError] = useState<string | undefined>()

  const categories = useQuery({
    queryKey: expenseKeys.categoryOptions,
    queryFn: fetchCategoryOptions,
    enabled: open,
    staleTime: 60_000,
  })

  const defaultBranch = expense
    ? expense.branch === null
      ? CENTRAL
      : String(expense.branch)
    : branchId
      ? String(branchId)
      : branches.length === 1 && !central
        ? String(branches[0]!.id)
        : ''
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(buildSchema(format.settings.currencyDecimals, today)),
    values: {
      category: expense ? String(expense.category) : '',
      amount: toInputAmount(expense?.amount),
      description: expense?.description ?? '',
      branch: defaultBranch,
      expense_date: expense?.expense_date ?? today,
    },
  })

  function close() {
    reset()
    setFormError(null)
    setFile(null)
    setRemoveFile(false)
    setFileError(undefined)
    onClose()
  }

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked) return
    if (!ATTACHMENT_TYPES.includes(picked.type)) return setFileError(t('expenses.fileType'))
    if (picked.size > MAX_ATTACHMENT_BYTES) return setFileError(t('expenses.fileSize'))
    setFileError(undefined)
    setFile(picked)
    setRemoveFile(false)
  }

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null)
    const values = {
      category: Number(data.category),
      amount: data.amount,
      description: data.description,
      branch: data.branch === CENTRAL ? null : Number(data.branch),
      expense_date: data.expense_date,
    }
    try {
      if (expense) {
        const changes = Object.fromEntries(
          FIELDS.filter((f) => dirtyFields[f]).map((f) => [f, values[f]]),
        )
        await updateExpense(expense.id, {
          ...changes,
          ...(file ? { attachment: file } : removeFile ? { attachment: null } : {}),
        })
        toast.success(t('expenses.saved'))
      } else {
        const created = await createExpense({ ...values, ...(file ? { attachment: file } : {}) })
        toast.success(t('expenses.created'), {
          action: {
            label: t('products.open'),
            onClick: () => void navigate(`/expenses/${created.id}`),
          },
        })
      }
      invalidateExpenses(queryClient)
      close()
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.attachment) {
        setFileError(error.fieldErrors.attachment.join(' '))
      }
      setFormError(applyServerErrors(error, setError, {}, [...FIELDS, 'attachment' as never]))
    }
  })

  const err = (field: keyof FormInput) => fieldMessage(t, errors[field]?.message)
  const options = (categories.data ?? []).filter((c) => c.is_active || c.id === expense?.category)
  const existingName = !removeFile && !file ? expense?.attachment_name : null

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      dismissible={!isSubmitting}
      title={expense ? t('expenses.editTitle') : t('expenses.addTitle')}
      description={expense ? undefined : t('expenses.addBody')}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={isSubmitting}>
            {t('changePassword.cancel')}
          </Button>
          <Button
            type="submit"
            form="expense-form"
            loading={isSubmitting}
            disabled={Boolean(expense) && !isDirty && !file && !removeFile}
          >
            {expense ? t('expenses.save') : t('expenses.submit')}
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
        id="expense-form"
        onSubmit={(e) => void onSubmit(e)}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        <SelectField
          label={t('expenses.category')}
          error={err('category')}
          {...register('category')}
        >
          <option value="">{t('expenses.chooseCategory')}</option>
          {options.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.is_active ? c.name : t('products.categoryInactive', { name: c.name })}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t('expenses.amount')}
          inputMode="decimal"
          autoComplete="off"
          trailing={
            <span className="pr-3 text-sm text-ink-muted">{format.settings.currencyCode}</span>
          }
          error={err('amount')}
          {...register('amount')}
        />
        <SelectField label={t('expenses.branch')} error={err('branch')} {...register('branch')}>
          <option value="">{t('stock.chooseBranch')}</option>
          {central && <option value={CENTRAL}>{t('expenses.wholeBusiness')}</option>}
          {branches.map((b) => (
            <option key={b.id} value={String(b.id)}>
              {b.name}
            </option>
          ))}
        </SelectField>
        <TextField
          type="date"
          label={t('expenses.date')}
          max={today}
          error={err('expense_date')}
          {...register('expense_date')}
        />
        <TextAreaField
          className="sm:col-span-2"
          label={t('expenses.description')}
          placeholder={t('expenses.descriptionPlaceholder')}
          rows={3}
          error={err('description')}
          {...register('description')}
        />
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span id={`${fileId}-label`} className="text-sm font-medium text-ink">
            {t('expenses.receipt')}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {(file || existingName) && (
              <span className="inline-flex min-w-0 items-center gap-2 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink">
                <FileText className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{file?.name ?? existingName}</span>
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInput.current?.click()}
              leadingIcon={<Paperclip className="size-4" aria-hidden="true" />}
            >
              {file || existingName ? t('expenses.replaceFile') : t('expenses.attachFile')}
            </Button>
            {(file || existingName) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null)
                  setRemoveFile(Boolean(expense?.attachment))
                }}
                leadingIcon={<Trash2 className="size-4" aria-hidden="true" />}
              >
                {t('products.removePhoto')}
              </Button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={ATTACHMENT_TYPES.join(',')}
              className="sr-only"
              tabIndex={-1}
              aria-labelledby={`${fileId}-label`}
              onChange={pick}
            />
          </div>
          {fileError ? (
            <p className="text-sm text-danger" role="alert">
              {fileError}
            </p>
          ) : (
            <p className="text-sm text-ink-muted">{t('expenses.receiptHint')}</p>
          )}
        </div>
      </form>
    </Dialog>
  )
}
