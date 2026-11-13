import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowDown, ArrowUp, Banknote, Clock, ReceiptText } from 'lucide-react'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { ListError } from '@/components/feedback/ListStates'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'
import { TextField } from '@/components/ui/TextField'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useBusiness } from '@/features/business/useBusiness'
import { cn } from '@/lib/cn'

import { dashboardKeys, fetchDashboard, type Dashboard, type DashProduct } from './api'
import { matchPreset, presetRange, type Preset } from './period'

// The chart library is large: load it on its own so the figures show first.
const SalesTrendChart = lazy(() =>
  import('./SalesTrendChart').then((m) => ({ default: m.SalesTrendChart })),
)

/** Owner dashboard (SRS 5.3, DASH-001..DASH-014). */
export function DashboardPage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { business, branch, branchId, format } = useBusiness()
  const [searchParams, setSearchParams] = useSearchParams()
  const today = format.today()
  const month = presetRange('month', today)
  const from = searchParams.get('from') ?? month.from
  const to = searchParams.get('to') ?? month.to
  // "Custom" stays chosen even while its dates happen to match a preset.
  const [customChosen, setCustomChosen] = useState(false)
  const preset = customChosen ? 'custom' : matchPreset(from, to, today)

  const setRange = (range: { from: string; to: string }) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        const isDefault = range.from === month.from && range.to === month.to
        if (isDefault) {
          next.delete('from')
          next.delete('to')
        } else {
          next.set('from', range.from)
          next.set('to', range.to)
        }
        return next
      },
      { replace: true },
    )

  const params = { from, to, branch: branchId }
  const query = useQuery({
    queryKey: dashboardKeys.view(params),
    queryFn: () => fetchDashboard(params),
    placeholderData: keepPreviousData,
    refetchInterval: 120_000, // a live view of the day
  })
  const data = query.data

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            {t('dashboard.welcome', { name: user.first_name || user.username })}
          </h2>
          {business && <p className="text-sm font-medium text-ink">{business.name}</p>}
          <p className="text-sm text-ink-muted">
            {branch ? t('dashboard.scopeOne', { branch: branch.name }) : t('dashboard.scopeAll')} ·{' '}
            {t('dashboard.periodLine', { from: format.date(from), to: format.date(to) })}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="max-w-full overflow-x-auto">
            <Segmented<Preset>
              label={t('dashboard.period')}
              value={preset}
              onChange={(p) => {
                setCustomChosen(p === 'custom')
                if (p !== 'custom') setRange(presetRange(p, today))
              }}
              options={[
                { value: 'today', label: t('dashboard.presets.today') },
                { value: 'week', label: t('dashboard.presets.week') },
                { value: 'month', label: t('dashboard.presets.month') },
                { value: 'last30', label: t('dashboard.presets.last30') },
                { value: 'custom', label: t('dashboard.presets.custom') },
              ]}
            />
          </div>
          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <TextField
                type="date"
                label={t('sales.from')}
                value={from}
                max={to}
                onChange={(e) => e.target.value && setRange({ from: e.target.value, to })}
              />
              <TextField
                type="date"
                label={t('sales.to')}
                value={to}
                min={from}
                max={today}
                onChange={(e) => e.target.value && setRange({ from, to: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      {query.isError && !data ? (
        <Card>
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        </Card>
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <div
          className={cn(
            'flex flex-col gap-4 transition-opacity sm:gap-6',
            query.isPlaceholderData && 'opacity-60',
          )}
          aria-busy={query.isFetching}
        >
          {data.other_currencies_in_period.length > 0 && (
            <p className="text-sm text-ink-muted">
              {t('dashboard.otherCurrencies', {
                codes: data.other_currencies_in_period.join(', '),
                code: data.currency.code,
              })}
            </p>
          )}
          <Headline data={data} />
          <Overview data={data} />
          <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card>
              <CardHeader
                title={t('dashboard.trendTitle')}
                description={
                  data.sales_trend.truncated
                    ? t('dashboard.trendTruncated')
                    : t('dashboard.trendBody')
                }
              />
              <div className="p-5 pt-3 sm:px-6">
                {data.sales_trend.days.length === 0 ? (
                  <p className="text-sm text-ink-muted">{t('dashboard.noSales')}</p>
                ) : (
                  <Suspense
                    fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-muted" />}
                  >
                    <SalesTrendChart days={data.sales_trend.days} />
                  </Suspense>
                )}
              </div>
            </Card>
            {branchId === null && data.branch_performance.branches.length > 1 ? (
              <Branches data={data} />
            ) : (
              <Inventory data={data} />
            )}
          </div>
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <ProductList
              title={t('dashboard.bestSellers')}
              products={data.products.best_selling}
              icon={<ArrowUp className="size-4 text-success" aria-hidden="true" />}
            />
            <ProductList
              title={t('dashboard.lowestSellers')}
              products={data.products.lowest_selling}
              icon={<ArrowDown className="size-4 text-ink-muted" aria-hidden="true" />}
            />
          </div>
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {branchId === null && data.branch_performance.branches.length > 1 && (
              <Inventory data={data} />
            )}
            <Operations data={data} />
            <RecentSales data={data} />
          </div>
        </div>
      )}
    </div>
  )
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: ReactNode
  tone?: string
}) {
  return (
    <Card className="p-4 sm:p-5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className={cn('mt-1 text-xl font-semibold text-ink tabular-nums sm:text-2xl', tone)}>
        {value}
      </dd>
      {sub && <dd className="mt-0.5 text-xs text-ink-muted">{sub}</dd>}
    </Card>
  )
}

/** DASH-001/002: today, this week, this month — always, whatever period is selected. */
function Headline({ data }: { data: Dashboard }) {
  const { t } = useTranslation()
  const { format } = useBusiness()
  const windows = [
    ['today', data.sales.today],
    ['week', data.sales.this_week],
    ['month', data.sales.this_month],
  ] as const
  return (
    <section aria-label={t('dashboard.salesHeadline')}>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {windows.map(([key, w]) => (
          <Tile
            key={key}
            label={t(`dashboard.sales.${key}`)}
            value={format.money(w.net_sales)}
            sub={t('dashboard.transactionsCount', { count: w.transactions })}
          />
        ))}
      </dl>
    </section>
  )
}

/** Revenue, gross profit and operating result kept distinct (SRS 5.3 note, BRULE-015). */
function Overview({ data }: { data: Dashboard }) {
  const { t } = useTranslation()
  const { format } = useBusiness()
  const o = data.overview
  const margin = Number(o.revenue) > 0 ? (Number(o.gross_profit) / Number(o.revenue)) * 100 : null
  const result = Number(o.operating_result)
  return (
    <Card>
      <CardHeader title={t('dashboard.overviewTitle')} description={t('dashboard.overviewBody')} />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 pt-4 sm:px-6 md:grid-cols-4">
        <Figure label={t('dashboard.revenue')} value={format.money(o.revenue)} strong />
        <Figure label={t('dashboard.cogs')} value={format.money(o.cost_of_goods_sold)} />
        <Figure
          label={t('dashboard.grossProfit')}
          value={format.money(o.gross_profit)}
          sub={
            margin === null ? undefined : t('dashboard.margin', { margin: format.percent(margin) })
          }
          strong
        />
        <Figure
          label={t('dashboard.expenses')}
          value={format.money(o.expenses)}
          sub={t('dashboard.expensesNote')}
        />
        <Figure
          label={t('dashboard.operatingResult')}
          value={format.money(o.operating_result, { signed: true })}
          tone={result < 0 ? 'text-danger' : undefined}
          strong
        />
        <Figure label={t('dashboard.transactions')} value={format.number(o.transactions)} />
        <Figure
          label={t('dashboard.averageSale')}
          value={format.money(o.average_transaction_value)}
        />
        <Figure label={t('dashboard.refunds')} value={format.money(o.refunds)} />
      </dl>
    </Card>
  )
}

function Figure(props: {
  label: string
  value: string
  sub?: string
  strong?: boolean
  tone?: string
}) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{props.label}</dt>
      <dd
        className={cn(
          'tabular-nums',
          props.strong ? 'text-lg font-semibold text-ink' : 'text-base font-medium text-ink',
          props.tone,
        )}
      >
        {props.value}
      </dd>
      {props.sub && <dd className="text-xs text-ink-muted">{props.sub}</dd>}
    </div>
  )
}

/** DASH-006/007 and branch comparison: net sales per branch as ranked bars. */
function Branches({ data }: { data: Dashboard }) {
  const { t } = useTranslation()
  const { format, setBranchId } = useBusiness()
  const rows = data.branch_performance.branches.toSorted(
    (a, b) => Number(b.net_sales) - Number(a.net_sales),
  )
  const top = Math.max(...rows.map((r) => Number(r.net_sales)), 1)
  const best = data.branch_performance.best_branch?.branch_id
  const lowest = data.branch_performance.lowest_branch?.branch_id
  return (
    <Card>
      <CardHeader title={t('dashboard.branchesTitle')} description={t('dashboard.branchesBody')} />
      <ul className="flex flex-col gap-4 p-5 pt-4 sm:px-6">
        {rows.map((r) => (
          <li key={r.branch_id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <button
                type="button"
                className="flex min-w-0 items-center gap-2 font-medium text-ink hover:text-primary"
                onClick={() => setBranchId(r.branch_id)}
                title={t('dashboard.openBranch', { branch: r.branch_name })}
              >
                <span className="truncate">{r.branch_name}</span>
                {r.branch_id === best && <Badge tone="success">{t('dashboard.best')}</Badge>}
                {r.branch_id === lowest && r.branch_id !== best && (
                  <Badge tone="neutral">{t('dashboard.lowest')}</Badge>
                )}
              </button>
              <span className="shrink-0 font-semibold text-ink tabular-nums">
                {format.money(r.net_sales)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(2, (Number(r.net_sales) / top) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-ink-muted">
              {t('dashboard.branchLine', {
                count: r.transactions,
                average: format.money(r.average_transaction_value),
                expenses: format.money(r.expenses),
              })}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** DASH-008 (and the lowest sellers): quantity and revenue per product. */
function ProductList({
  title,
  products,
  icon,
}: {
  title: string
  products: DashProduct[]
  icon: ReactNode
}) {
  const { t } = useTranslation()
  const { format } = useBusiness()
  const top = Math.max(...products.map((p) => Number(p.revenue)), 1)
  return (
    <Card>
      <CardHeader title={title} />
      {products.length === 0 ? (
        <p className="p-5 pt-3 text-sm text-ink-muted sm:px-6">{t('dashboard.noSales')}</p>
      ) : (
        <ol className="flex flex-col gap-3 p-5 pt-4 sm:px-6">
          {products.map((p, i) => (
            <li key={p.product_id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-ink-muted tabular-nums">{i + 1}.</span>
                  {i === 0 && icon}
                  <span className="truncate font-medium text-ink">{p.product_name}</span>
                </span>
                <span className="shrink-0 text-ink tabular-nums">{format.money(p.revenue)}</span>
              </div>
              <div className="ml-7 flex items-center gap-2">
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-espresso-400"
                    style={{ width: `${Math.max(2, (Number(p.revenue) / top) * 100)}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-xs text-ink-muted tabular-nums">
                  {t('dashboard.sold', { quantity: format.number(p.quantity_sold) })}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

/** DASH-009 and inventory overview. */
function Inventory({ data }: { data: Dashboard }) {
  const { t } = useTranslation()
  const { format } = useBusiness()
  const inv = data.inventory
  return (
    <Card>
      <CardHeader
        title={t('dashboard.stockTitle')}
        actions={
          <Link
            to="/inventory?level=low"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t('dashboard.seeStock')}
          </Link>
        }
      />
      <dl className="grid grid-cols-2 gap-4 px-5 pt-4 sm:px-6">
        <Figure
          label={t('dashboard.lowStock')}
          value={format.number(inv.low_stock_count)}
          tone={inv.low_stock_count > 0 ? 'text-warning' : undefined}
          strong
        />
        <Figure
          label={t('dashboard.stockValue')}
          value={format.money(inv.stock_valuation)}
          strong
        />
      </dl>
      {inv.low_stock.length === 0 ? (
        <p className="p-5 text-sm text-ink-muted sm:px-6">{t('dashboard.stockOk')}</p>
      ) : (
        <ul className="divide-y divide-border px-5 py-2 sm:px-6">
          {inv.low_stock.slice(0, 6).map((row) => (
            <li
              key={`${row.branch_id}-${row.product_id}`}
              className="flex items-center justify-between gap-3 py-2.5 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{row.product_name}</span>
                  <span className="block text-xs text-ink-muted">{row.branch_name}</span>
                </span>
              </span>
              <span className="shrink-0 text-ink-muted tabular-nums">
                {t('dashboard.stockLine', {
                  quantity: format.number(row.quantity),
                  minimum: format.number(row.minimum_threshold),
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Active cash sessions and pending approvals. */
function Operations({ data }: { data: Dashboard }) {
  const { t } = useTranslation()
  const { format } = useBusiness()
  const ops = data.operations
  const pending = ops.pending_approvals.expenses
  return (
    <Card>
      <CardHeader title={t('dashboard.operationsTitle')} />
      <div className="flex flex-col gap-4 p-5 pt-4 sm:px-6">
        {pending.length > 0 && (
          <Link
            to="/expenses"
            className="flex items-center justify-between gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning hover:underline"
          >
            <span className="flex items-center gap-2 font-medium">
              <Clock className="size-4" aria-hidden="true" />
              {t('dashboard.pendingExpenses', { count: pending.reduce((n, p) => n + p.count, 0) })}
            </span>
            <span className="tabular-nums">
              {pending.map((p) => format.money(p.total, { currency: p.currency_code })).join(' + ')}
            </span>
          </Link>
        )}
        <div>
          <p className="mb-2 text-sm font-medium text-ink">
            {t('dashboard.openDrawers', { count: ops.active_cash_sessions.length })}
          </p>
          {ops.active_cash_sessions.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('dashboard.noOpenDrawers')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {ops.active_cash_sessions.map((s) => (
                <li key={s.session_id}>
                  <Link
                    to={`/cash/${s.session_id}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Banknote className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{s.cashier}</span>
                        <span className="block text-xs text-ink-muted">
                          {t('dashboard.drawerLine', {
                            branch: s.branch_name,
                            since: format.time(s.opened_at),
                          })}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-ink tabular-nums">
                      {format.money(s.expected_cash, { currency: s.currency_code })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  )
}

/** Recent transactions (DASH-010). */
function RecentSales({ data }: { data: Dashboard }) {
  const { t } = useTranslation()
  const { format } = useBusiness()
  const sales = data.operations.recent_transactions
  return (
    <Card>
      <CardHeader
        title={t('dashboard.recentSales')}
        actions={
          <Link to="/sales" className="text-sm font-medium text-primary hover:underline">
            {t('dashboard.seeSales')}
          </Link>
        }
      />
      {sales.length === 0 ? (
        <p className="p-5 pt-3 text-sm text-ink-muted sm:px-6">{t('dashboard.noSales')}</p>
      ) : (
        <ul className="divide-y divide-border px-5 py-2 sm:px-6">
          {sales.slice(0, 8).map((s) => (
            <li key={s.sale_id}>
              <Link
                to={`/sales/${s.sale_id}`}
                className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ReceiptText className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{s.cashier}</span>
                    <span className="block text-xs text-ink-muted">
                      {[s.branch_name, format.time(s.created_at)].join(' · ')}
                    </span>
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 tabular-nums',
                    s.status === 'completed' ? 'text-ink' : 'text-ink-muted line-through',
                  )}
                >
                  {format.money(s.total_amount, { currency: s.currency_code })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function DashboardSkeleton() {
  const { t } = useTranslation()
  return (
    <div role="status" aria-label={t('app.loading')} className="flex flex-col gap-4 sm:gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-card bg-surface-muted" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-card bg-surface-muted" />
      <div className="h-72 animate-pulse rounded-card bg-surface-muted" />
    </div>
  )
}
