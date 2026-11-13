import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, Download, Printer, ReceiptText, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { ListError } from '@/components/feedback/ListStates'
import { Loader } from '@/components/feedback/Loader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { can } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useFormat } from '@/features/business/useBusiness'
import { ApiError, getErrorMessage } from '@/lib/api/errors'

import { cancelSale, fetchSale, saleKeys, type Sale } from './api'
import { downloadReceipt, printReceipt } from './receipt'
import { RefundDialog } from './RefundDialog'
import { SaleStateBadge } from './SaleStateBadge'

/** One transaction: lines, payments, receipt, refund / cancel (POS-015..POS-020). */
export function SaleDetailPage() {
  const { t } = useTranslation()
  const id = Number(useParams().saleId)
  const query = useQuery({
    queryKey: saleKeys.detail(id),
    queryFn: () => fetchSale(id),
    enabled: Number.isInteger(id),
  })
  const back = (
    <Link
      to="/sales"
      className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-muted hover:text-ink"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t('sales.backToList')}
    </Link>
  )
  const missing =
    !Number.isInteger(id) || (query.error instanceof ApiError && query.error.status === 404)
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {back}
      {missing ? (
        <Card>
          <EmptyState
            icon={ReceiptText}
            title={t('sales.notFoundTitle')}
            description={t('sales.notFoundBody')}
          />
        </Card>
      ) : query.isPending ? (
        <Loader label={t('app.loading')} />
      ) : query.isError ? (
        <Card>
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        </Card>
      ) : (
        <SaleDetail sale={query.data} />
      )}
    </div>
  )
}

function SaleDetail({ sale }: { sale: Sale }) {
  const { t } = useTranslation()
  const format = useFormat()
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const [refunding, setRefunding] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const money = (v: string) =>
    format.money(v, { currency: sale.currency_code, decimals: sale.currency_decimal_places })

  const canModify = can(user.role, 'sales.refund')
  const hasPayments = sale.payments.some((p) => !p.is_refund)
  const refundable = Number(sale.paid_amount) - Number(sale.refunded_amount) > 0
  const showRefund = canModify && sale.status !== 'cancelled' && hasPayments && refundable
  const showCancel = canModify && sale.status === 'completed' && !hasPayments

  const print = useMutation({
    mutationFn: () => printReceipt(sale.id),
    onError: (e) => toast.error(getErrorMessage(e)),
    meta: { silentError: true },
  })
  const download = useMutation({
    mutationFn: () => downloadReceipt(sale.id, sale.transaction_number),
    onError: (e) => toast.error(getErrorMessage(e)),
    meta: { silentError: true },
  })
  const cancel = useMutation({
    mutationFn: () => cancelSale(sale.id, cancelReason.trim()),
    onSuccess: () => {
      toast.success(t('sales.cancelled', { number: sale.transaction_number }))
      void queryClient.invalidateQueries({ queryKey: saleKeys.all })
      setCancelling(false)
    },
    meta: { silentError: true },
  })

  return (
    <>
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-ink tabular-nums sm:text-2xl">
                {sale.transaction_number}
              </h2>
              <SaleStateBadge sale={sale} />
            </div>
            <p className="text-sm text-ink-muted">
              {t('sales.madeBy', {
                when: format.dateTime(sale.created_at),
                cashier: sale.cashier_name,
                branch: sale.branch_name,
              })}
            </p>
            {sale.status === 'cancelled' && sale.cancellation_reason && (
              <p className="text-sm text-ink-muted">
                {t('sales.cancelReasonLine', { reason: sale.cancellation_reason })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={print.isPending}
              onClick={() => print.mutate()}
              leadingIcon={<Printer className="size-4" aria-hidden="true" />}
            >
              {t('pos.printReceipt')}
            </Button>
            <Button
              variant="ghost"
              loading={download.isPending}
              onClick={() => download.mutate()}
              leadingIcon={<Download className="size-4" aria-hidden="true" />}
            >
              {t('pos.downloadReceipt')}
            </Button>
            {showRefund && (
              <Button
                variant="danger"
                onClick={() => setRefunding(true)}
                leadingIcon={<Undo2 className="size-4" aria-hidden="true" />}
              >
                {t('sales.refund')}
              </Button>
            )}
            {showCancel && (
              <Button
                variant="danger"
                onClick={() => setCancelling(true)}
                leadingIcon={<Ban className="size-4" aria-hidden="true" />}
              >
                {t('sales.cancel')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title={t('sales.items')} />
          <ul className="divide-y divide-border px-5 pb-2 sm:px-6">
            {sale.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{item.product_name}</p>
                  <p className="text-sm text-ink-muted tabular-nums">
                    {t('sales.lineDetail', {
                      quantity: format.number(item.quantity),
                      price: money(item.unit_price),
                    })}
                    {Number(item.discount_amount) > 0 &&
                      ` · ${t('sales.lineDiscount', { amount: money(item.discount_amount) })}`}
                  </p>
                </div>
                <p className="font-medium whitespace-nowrap tabular-nums">
                  {money(item.line_total)}
                </p>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-1 border-t border-border px-5 py-4 text-sm sm:px-6">
            <div className="flex justify-between text-ink-muted">
              <dt>{t('pos.subtotal')}</dt>
              <dd className="tabular-nums">{money(sale.subtotal)}</dd>
            </div>
            {Number(sale.discount_total) > 0 && (
              <div className="flex justify-between text-ink-muted">
                <dt>{t('pos.discounts')}</dt>
                <dd className="tabular-nums">−{money(sale.discount_total)}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-ink">
              <dt>{t('pos.total')}</dt>
              <dd className="tabular-nums">{money(sale.total_amount)}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title={t('sales.payments')} />
          <div className="px-5 pb-5 sm:px-6">
            {sale.payments.length === 0 ? (
              <p className="pt-3 text-sm text-ink-muted">{t('sales.noPayments')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {sale.payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {p.is_refund
                          ? t('sales.refundOf', { method: t(`payments.${p.method}`) })
                          : t(`payments.${p.method}`)}
                      </p>
                      <p className="text-sm text-ink-muted">
                        {[format.dateTime(p.created_at), p.reference].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <p
                      className={
                        p.is_refund
                          ? 'font-medium whitespace-nowrap text-danger tabular-nums'
                          : 'font-medium whitespace-nowrap tabular-nums'
                      }
                    >
                      {p.is_refund ? '−' : ''}
                      {money(p.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {Number(sale.balance_due) > 0 && (
              <p className="mt-3 text-sm font-medium text-warning">
                {t('sales.balanceDue', { amount: money(sale.balance_due) })}
              </p>
            )}
          </div>
        </Card>
      </div>

      {showRefund && (
        <RefundDialog sale={sale} open={refunding} onClose={() => setRefunding(false)} />
      )}
      <ConfirmDialog
        open={cancelling}
        onClose={() => {
          setCancelling(false)
          cancel.reset()
        }}
        onConfirm={() => cancel.mutate()}
        title={t('sales.cancelTitle', { number: sale.transaction_number })}
        confirmLabel={t('sales.cancel')}
        pending={cancel.isPending}
        error={cancel.error ? getErrorMessage(cancel.error) : null}
      >
        <p>{t('sales.cancelBody')}</p>
        <TextAreaField
          label={t('sales.reason')}
          rows={2}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </ConfirmDialog>
    </>
  )
}
