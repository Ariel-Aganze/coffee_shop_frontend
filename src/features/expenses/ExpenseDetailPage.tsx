import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, FileText, Pencil, Wallet, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { ListError } from '@/components/feedback/ListStates'
import { Loader } from '@/components/feedback/Loader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useFormat } from '@/features/business/useBusiness'
import { ApiError, getErrorMessage } from '@/lib/api/errors'

import {
  approveExpense,
  canEdit,
  canReview,
  expenseKeys,
  fetchExpense,
  invalidateExpenses,
  rejectExpense,
  type Expense,
} from './api'
import { ExpenseFormDialog } from './ExpenseFormDialog'
import { ExpenseStatusBadge } from './parts'

export function ExpenseDetailPage() {
  const { t } = useTranslation()
  const id = Number(useParams().expenseId)
  const query = useQuery({
    queryKey: expenseKeys.detail(id),
    queryFn: () => fetchExpense(id),
    enabled: Number.isInteger(id),
  })
  const missing =
    !Number.isInteger(id) || (query.error instanceof ApiError && query.error.status === 404)
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Link
        to="/expenses"
        className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('expenses.backToList')}
      </Link>
      {missing ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title={t('expenses.notFoundTitle')}
            description={t('expenses.notFoundBody')}
          />
        </Card>
      ) : query.isPending ? (
        <Loader label={t('app.loading')} />
      ) : query.isError ? (
        <Card>
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        </Card>
      ) : (
        <ExpenseDetail expense={query.data} />
      )}
    </div>
  )
}

function ExpenseDetail({ expense }: { expense: Expense }) {
  const { t } = useTranslation()
  const format = useFormat()
  const user = useCurrentUser()
  const [editing, setEditing] = useState(false)
  const [reviewing, setReviewing] = useState<'approve' | 'reject' | null>(null)
  const money = format.money(expense.amount, {
    currency: expense.currency_code,
    decimals: expense.currency_decimal_places,
  })

  const rows: [string, React.ReactNode][] = [
    [t('expenses.date'), format.date(expense.expense_date)],
    [t('expenses.category'), expense.category_name],
    [t('expenses.branch'), expense.branch_name ?? t('expenses.wholeBusiness')],
    [
      t('expenses.filedBy'),
      t('expenses.filedLine', {
        name: expense.submitted_by_name,
        when: format.dateTime(expense.created_at),
      }),
    ],
  ]

  return (
    <>
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-2xl font-semibold text-ink tabular-nums">{money}</p>
              <ExpenseStatusBadge status={expense.status} />
            </div>
            <h2 className="text-lg text-ink">{expense.description}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {canReview(user, expense) && (
              <>
                <Button
                  onClick={() => setReviewing('approve')}
                  leadingIcon={<Check className="size-4" aria-hidden="true" />}
                >
                  {t('expenses.approve')}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setReviewing('reject')}
                  leadingIcon={<X className="size-4" aria-hidden="true" />}
                >
                  {t('expenses.reject')}
                </Button>
              </>
            )}
            {canEdit(user, expense) && (
              <Button
                variant="secondary"
                onClick={() => setEditing(true)}
                leadingIcon={<Pencil className="size-4" aria-hidden="true" />}
              >
                {t('expenses.edit')}
              </Button>
            )}
          </div>
        </div>

        <dl className="mt-5 grid gap-x-8 gap-y-3 border-t border-border pt-5 text-sm sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-ink-muted">{label}</dt>
              <dd className="text-ink">{value}</dd>
            </div>
          ))}
          <div className="sm:col-span-2">
            <dt className="text-ink-muted">{t('expenses.receipt')}</dt>
            <dd>
              {expense.attachment ? (
                <a
                  href={expense.attachment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                  <FileText className="size-4" aria-hidden="true" />
                  {expense.attachment_name}
                </a>
              ) : (
                <span className="text-ink-muted">{t('expenses.noReceipt')}</span>
              )}
            </dd>
          </div>
        </dl>

        {expense.status !== 'pending' && (
          <Alert tone={expense.status === 'approved' ? 'success' : 'danger'} className="mt-5">
            {t(expense.status === 'approved' ? 'expenses.approvedLine' : 'expenses.rejectedLine', {
              name: expense.reviewed_by_name ?? '—',
              when: format.dateTime(expense.reviewed_at),
            })}
            {expense.review_note && <span className="block">“{expense.review_note}”</span>}
          </Alert>
        )}
      </Card>

      {canEdit(user, expense) && (
        <ExpenseFormDialog open={editing} onClose={() => setEditing(false)} expense={expense} />
      )}
      <ReviewDialog expense={expense} decision={reviewing} onClose={() => setReviewing(null)} />
    </>
  )
}

/** Approve (optional note) or reject (reason required) — EXP-006. */
function ReviewDialog({
  expense,
  decision,
  onClose,
}: {
  expense: Expense
  decision: 'approve' | 'reject' | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function close() {
    setNote('')
    setError(null)
    onClose()
  }

  async function submit() {
    if (decision === 'reject' && !note.trim()) return setError(t('expenses.rejectReasonRequired'))
    setPending(true)
    try {
      if (decision === 'approve') await approveExpense(expense.id, note.trim())
      else await rejectExpense(expense.id, note.trim())
      toast.success(decision === 'approve' ? t('expenses.approved') : t('expenses.rejected'))
      invalidateExpenses(queryClient)
      close()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={decision !== null}
      onClose={close}
      dismissible={!pending}
      title={decision === 'reject' ? t('expenses.rejectTitle') : t('expenses.approveTitle')}
      description={decision === 'approve' ? t('expenses.approveBody') : t('expenses.rejectBody')}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={pending}>
            {t('changePassword.cancel')}
          </Button>
          <Button
            variant={decision === 'reject' ? 'danger' : 'primary'}
            loading={pending}
            onClick={() => void submit()}
          >
            {decision === 'reject' ? t('expenses.reject') : t('expenses.approve')}
          </Button>
        </>
      }
    >
      <TextAreaField
        label={decision === 'reject' ? t('expenses.rejectReason') : t('expenses.noteOptional')}
        rows={3}
        value={note}
        onChange={(e) => {
          setNote(e.target.value)
          setError(null)
        }}
        error={error ?? undefined}
      />
    </Dialog>
  )
}
