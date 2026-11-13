import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Banknote, Lock, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { ListError, ListSkeleton } from '@/components/feedback/ListStates'
import { Loader } from '@/components/feedback/Loader'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { can } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useFormat } from '@/features/business/useBusiness'
import { ApiError } from '@/lib/api/errors'
import { cn } from '@/lib/cn'

import { cashKeys, fetchReconciliation, fetchSession, type CashSession } from './api'
import { CloseDrawerDialog } from './CloseDrawerDialog'
import { MovementDialog } from './MovementDialog'

/** One cash session: expected-cash breakdown, movements, closing (SRS 5.10). */
export function CashSessionPage() {
  const { t } = useTranslation()
  const id = Number(useParams().sessionId)
  const query = useQuery({
    queryKey: cashKeys.detail(id),
    queryFn: () => fetchSession(id),
    enabled: Number.isInteger(id),
  })
  const missing =
    !Number.isInteger(id) || (query.error instanceof ApiError && query.error.status === 404)
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Link
        to="/cash"
        className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('cash.backToList')}
      </Link>
      {missing ? (
        <Card>
          <EmptyState
            icon={Banknote}
            title={t('cash.notFoundTitle')}
            description={t('cash.notFoundBody')}
          />
        </Card>
      ) : query.isPending ? (
        <Loader label={t('app.loading')} />
      ) : query.isError ? (
        <Card>
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        </Card>
      ) : (
        <SessionDetail session={query.data} />
      )}
    </div>
  )
}

function SessionDetail({ session }: { session: CashSession }) {
  const { t } = useTranslation()
  const format = useFormat()
  const user = useCurrentUser()
  const [moving, setMoving] = useState(false)
  const [closing, setClosing] = useState(false)
  const isOpen = session.status === 'open'
  const money = (v: string | null | undefined) =>
    format.money(v, { currency: session.currency_code, decimals: session.currency_decimal_places })

  const reconciliation = useQuery({
    queryKey: cashKeys.reconciliation(session.id),
    queryFn: () => fetchReconciliation(session.id),
  })
  // The cashier runs their own drawer; managers and the owner can step in.
  const canAct = isOpen && (session.cashier === user.id || can(user.role, 'cash.manage'))

  const r = reconciliation.data
  const rows: { label: string; value: string | undefined; sign: '' | '+' | '−' }[] = r
    ? [
        { label: t('cash.opening'), value: r.opening, sign: '' },
        { label: t('cash.cashSales'), value: r.cash_sales, sign: '+' },
        { label: t('cash.types.inflow'), value: r.cash_inflows, sign: '+' },
        { label: t('cash.cashRefunds'), value: r.cash_refunds, sign: '−' },
        { label: t('cash.types.expense'), value: r.cash_expenses, sign: '−' },
        { label: t('cash.types.withdrawal'), value: r.cash_withdrawals, sign: '−' },
      ]
    : []
  const difference = Number(session.difference ?? 0)

  return (
    <>
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-ink sm:text-2xl">
                {t('cash.sessionOf', { name: session.cashier_name })}
              </h2>
              {isOpen ? (
                <Badge tone="success" dot>
                  {t('cash.statusOpen')}
                </Badge>
              ) : (
                <Badge tone="neutral">
                  <Lock className="size-3" aria-hidden="true" />
                  {t('cash.statusClosed')}
                </Badge>
              )}
            </div>
            <p className="text-sm text-ink-muted">
              {isOpen
                ? t('cash.openedLine', {
                    branch: session.branch_name,
                    when: format.dateTime(session.opened_at),
                  })
                : t('cash.closedLine', {
                    branch: session.branch_name,
                    from: format.dateTime(session.opened_at),
                    to: format.dateTime(session.closed_at),
                  })}
            </p>
          </div>
          {canAct && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => setMoving(true)}
                leadingIcon={<Plus className="size-4" aria-hidden="true" />}
              >
                {t('cash.recordMovement')}
              </Button>
              <Button
                onClick={() => setClosing(true)}
                disabled={!r}
                leadingIcon={<Lock className="size-4" aria-hidden="true" />}
              >
                {t('cash.close')}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={isOpen ? t('cash.expectedNow') : t('cash.reconciliation')}
            description={t('cash.formula')}
          />
          <div className="px-5 pt-3 pb-5 sm:px-6">
            {reconciliation.isPending ? (
              <ListSkeleton rows={3} />
            ) : reconciliation.isError ? (
              <ListError
                error={reconciliation.error}
                onRetry={() => void reconciliation.refetch()}
              />
            ) : (
              <dl className="flex flex-col gap-2 text-sm">
                {rows.map((row) => (
                  <div key={row.label} className="flex justify-between text-ink-muted">
                    <dt>{row.label}</dt>
                    <dd className="tabular-nums">
                      {row.sign && Number(row.value) > 0 ? `${row.sign} ` : ''}
                      {money(row.value)}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-ink">
                  <dt>{t('cash.expected')}</dt>
                  <dd className="tabular-nums">{money(r?.expected_cash)}</dd>
                </div>
                {!isOpen && (
                  <>
                    <div className="flex justify-between text-ink">
                      <dt>{t('cash.counted')}</dt>
                      <dd className="tabular-nums">{money(session.actual_cash)}</dd>
                    </div>
                    <div
                      className={cn(
                        'flex justify-between font-semibold',
                        difference === 0
                          ? 'text-success'
                          : difference > 0
                            ? 'text-warning'
                            : 'text-danger',
                      )}
                    >
                      <dt>{t('cash.difference')}</dt>
                      <dd className="tabular-nums">
                        {difference > 0 ? '+' : ''}
                        {money(session.difference)}
                      </dd>
                    </div>
                    {session.discrepancy_explanation && (
                      <Alert tone="info" className="mt-2">
                        {session.discrepancy_explanation}
                      </Alert>
                    )}
                  </>
                )}
              </dl>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t('cash.movements')} description={t('cash.movementsBody')} />
          <div className="px-5 pt-1 pb-5 sm:px-6">
            {session.movements.length === 0 ? (
              <p className="pt-2 text-sm text-ink-muted">{t('cash.noMovements')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {session.movements.map((m) => {
                  const out = m.movement_type !== 'inflow'
                  return (
                    <li key={m.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{t(`cash.types.${m.movement_type}`)}</p>
                        <p className="text-sm text-ink-muted">
                          {[m.reason, m.reference, format.dateTime(m.created_at)]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <p
                        className={cn(
                          'font-medium whitespace-nowrap tabular-nums',
                          out ? 'text-danger' : 'text-success',
                        )}
                      >
                        {out ? '−' : '+'}
                        {money(m.amount)}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {canAct && (
        <>
          <MovementDialog session={session} open={moving} onClose={() => setMoving(false)} />
          {r && (
            <CloseDrawerDialog
              session={session}
              expected={r.expected_cash}
              open={closing}
              onClose={() => setClosing(false)}
            />
          )}
        </>
      )}
    </>
  )
}
