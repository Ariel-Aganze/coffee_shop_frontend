import { useMutation } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/TextField'
import { useFormat } from '@/features/business/useBusiness'
import { getErrorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/cn'
import { fromMinor } from '@/lib/minor'

import { checkout, type PaymentMethodOption, type Sale, type SaleInput } from './api'
import { cashSuggestions, planPayments, type PaymentRow } from './payments'

interface CheckoutDialogProps {
  open: boolean
  onClose: () => void
  due: bigint
  items: SaleInput['items']
  branchId: number
  methods: PaymentMethodOption[]
  /** Whether the cashier has an open drawer here (needed to take cash). */
  drawerOpen: boolean
  onOpenDrawer: () => void
  /** Same key for every retry of this cart, so a retry can't create a second sale. */
  idempotencyKey: string
  onDone: (sale: Sale, change: bigint) => void
}

let rowCounter = 0
const newRow = (method: PaymentRow['method'], amount: string): PaymentRow => ({
  key: `row-${++rowCounter}`,
  method,
  amount,
  reference: '',
})

/** Payment method(s), amount received and confirmation (POS-009, POS-010). */
export function CheckoutDialog(props: CheckoutDialogProps) {
  const { open, onClose, due, items, branchId, methods, drawerOpen, onOpenDrawer } = props
  const { t } = useTranslation()
  const format = useFormat()
  const id = useId()
  const decimals = format.settings.currencyDecimals
  const money = (minor: bigint) => format.money(fromMinor(minor, decimals))
  const defaultMethod = methods.some((m) => m.code === 'cash') ? 'cash' : methods[0]?.code

  const [rows, setRows] = useState<PaymentRow[]>([])
  const [showErrors, setShowErrors] = useState(false)
  // Start fresh every time the dialog opens.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && defaultMethod) {
      setRows([newRow(defaultMethod, fromMinor(due, decimals))])
      setShowErrors(false)
    }
  }

  const plan = planPayments(rows, due, decimals, methods)
  const usesCash = rows.some((r) => r.method === 'cash' && r.amount.trim() !== '')
  const needsDrawer = usesCash && !drawerOpen

  const submit = useMutation({
    mutationFn: () =>
      checkout({ branch: branchId, items, payments: plan.payments }, props.idempotencyKey),
    onSuccess: (sale) => props.onDone(sale, plan.change),
    meta: { silentError: true },
  })

  const update = (key: string, patch: Partial<PaymentRow>) =>
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  function addSplit() {
    const used = new Set(rows.map((r) => r.method))
    const next = methods.find((m) => !used.has(m.code))?.code ?? defaultMethod!
    // The new row takes what is left (empty if the first payment covers it all).
    const left = plan.remaining > 0n ? fromMinor(plan.remaining, decimals) : ''
    setRows((current) => [...current, newRow(next, left)])
  }

  function confirm() {
    setShowErrors(true)
    if (plan.issues.length === 0 && !needsDrawer && !submit.isPending) submit.mutate()
  }

  const rowIssue = (key: string) =>
    showErrors ? plan.issues.find((i) => 'key' in i && i.key === key) : undefined

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!submit.isPending}
      title={t('pos.checkoutTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submit.isPending}>
            {t('pos.backToCart')}
          </Button>
          <Button
            size="lg"
            type="submit"
            form={`${id}-form`}
            loading={submit.isPending}
            disabled={plan.remaining > 0n || needsDrawer}
          >
            {t('pos.completeSale')}
          </Button>
        </>
      }
    >
      <form
        id={`${id}-form`}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          confirm()
        }}
      >
        <div className="flex items-baseline justify-between rounded-xl bg-surface-muted px-4 py-3">
          <span className="text-sm font-medium text-ink-muted">{t('pos.totalDue')}</span>
          <span className="text-3xl font-semibold text-ink tabular-nums">{money(due)}</span>
        </div>

        {submit.isError && <Alert tone="danger">{getErrorMessage(submit.error)}</Alert>}

        {rows.map((row, index) => {
          const option = methods.find((m) => m.code === row.method)
          const issue = rowIssue(row.key)
          const otherPaid = rows
            .filter((r) => r.key !== row.key)
            .reduce((n, r) => n + (planPayments([r], due, decimals, methods).paid ?? 0n), 0n)
          const toCover = due > otherPaid ? due - otherPaid : 0n
          return (
            <fieldset
              key={row.key}
              className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:p-4"
            >
              <legend className="sr-only">{t('pos.paymentN', { n: index + 1 })}</legend>
              <div className="flex items-start gap-2">
                <fieldset className="min-w-0 flex-1">
                  <legend className="sr-only">{t('pos.method')}</legend>
                  <div className="flex flex-wrap gap-2">
                    {methods.map((m) => (
                      <label
                        key={m.code}
                        className={cn(
                          'flex h-10 cursor-pointer items-center rounded-control px-3.5 text-sm font-medium transition-colors',
                          'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
                          row.method === m.code
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-surface-muted text-ink hover:bg-espresso-200',
                        )}
                      >
                        <input
                          type="radio"
                          name={`${row.key}-method`}
                          value={m.code}
                          checked={row.method === m.code}
                          onChange={() => update(row.key, { method: m.code })}
                          className="sr-only"
                        />
                        {t(`payments.${m.code}`)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {rows.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('pos.removePayment')}
                    onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label={row.method === 'cash' ? t('pos.cashReceived') : t('pos.amount')}
                  inputMode="decimal"
                  autoComplete="off"
                  value={row.amount}
                  onChange={(e) => update(row.key, { amount: e.target.value })}
                  trailing={
                    <span className="pr-3 text-sm text-ink-muted">
                      {format.settings.currencyCode}
                    </span>
                  }
                  error={issue?.kind === 'amount-invalid' ? t('products.amountInvalid') : undefined}
                />
                {option?.needs_reference && (
                  <TextField
                    label={t('pos.reference')}
                    hint={t('pos.referenceHint')}
                    autoComplete="off"
                    value={row.reference}
                    onChange={(e) => update(row.key, { reference: e.target.value })}
                    error={
                      issue?.kind === 'reference-missing' ? t('pos.referenceRequired') : undefined
                    }
                  />
                )}
              </div>
              {row.method === 'cash' && toCover > 0n && (
                <div className="flex flex-wrap gap-2" aria-label={t('pos.quickCash')}>
                  {cashSuggestions(toCover, decimals).map((amount) => (
                    <Button
                      key={String(amount)}
                      variant="secondary"
                      size="sm"
                      onClick={() => update(row.key, { amount: fromMinor(amount, decimals) })}
                    >
                      {money(amount)}
                    </Button>
                  ))}
                </div>
              )}
            </fieldset>
          )
        })}

        {methods.length > 1 && (
          <Button
            variant="soft"
            className="self-start"
            onClick={addSplit}
            leadingIcon={<Plus className="size-4" aria-hidden="true" />}
          >
            {t('pos.splitPayment')}
          </Button>
        )}

        {plan.issues.some((i) => i.kind === 'non-cash-over') && (
          <Alert tone="danger">{t('pos.nonCashOver')}</Alert>
        )}
        {needsDrawer && (
          <Alert tone="info">
            <span className="flex flex-wrap items-center justify-between gap-2">
              {t('pos.drawerNeeded')}
              <Button size="sm" variant="secondary" onClick={onOpenDrawer}>
                {t('cash.open')}
              </Button>
            </span>
          </Alert>
        )}

        <dl className="flex flex-col gap-1 text-sm" aria-live="polite">
          <div className="flex justify-between text-ink-muted">
            <dt>{t('pos.paid')}</dt>
            <dd className="tabular-nums">{money(plan.paid)}</dd>
          </div>
          {plan.remaining > 0n ? (
            <div className="flex justify-between font-semibold text-danger">
              <dt>{t('pos.remaining')}</dt>
              <dd className="tabular-nums">{money(plan.remaining)}</dd>
            </div>
          ) : plan.change > 0n ? (
            <div className="flex items-baseline justify-between font-semibold text-success">
              <dt>{t('pos.change')}</dt>
              <dd className="text-xl tabular-nums">{money(plan.change)}</dd>
            </div>
          ) : (
            <div className="flex justify-between font-semibold text-success">
              <dt>{t('pos.fullyPaid')}</dt>
              <dd aria-hidden="true">✓</dd>
            </div>
          )}
        </dl>
      </form>
    </Dialog>
  )
}
