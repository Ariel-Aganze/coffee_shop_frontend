import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChartColumn, Download, FileText } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { ListError, ListSkeleton } from '@/components/feedback/ListStates'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { SelectField } from '@/components/ui/SelectField'
import { TextField } from '@/components/ui/TextField'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useBusiness } from '@/features/business/useBusiness'
import { matchPreset, presetRange, type Preset } from '@/features/dashboard/period'
import { MOVEMENT_TYPES } from '@/features/inventory/api'
import { getErrorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/cn'

import { downloadReport, fetchReport, reportKeys, type ReportQuery } from './api'
import { findReport, type ReportDef } from './catalog'
import { ReportFigures, ReportTable } from './ReportTable'

const SalesTrendChart = lazy(() =>
  import('@/features/dashboard/SalesTrendChart').then((m) => ({ default: m.SalesTrendChart })),
)

/** Movement-type filters that answer the SRS inventory reports directly. */
const MOVEMENT_FILTERS = [
  { value: 'damaged,expired', key: 'losses' },
  { value: 'purchase', key: 'purchases' },
  { value: 'adjustment', key: 'corrections' },
] as const

/** One report: filters, results, CSV/PDF export (REP-004..REP-018). */
export function ReportPage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const report = findReport(useParams().slug)

  if (!report || !report.roles.includes(user.role)) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <Card>
          <EmptyState
            icon={ChartColumn}
            title={t('reports.notFoundTitle')}
            description={t('reports.notFoundBody')}
          />
        </Card>
      </div>
    )
  }
  return <Report key={report.slug} report={report} />
}

function BackLink() {
  const { t } = useTranslation()
  return (
    <Link
      to="/reports"
      className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-muted hover:text-ink"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t('reports.backToList')}
    </Link>
  )
}

function Report({ report }: { report: ReportDef }) {
  const { t } = useTranslation()
  const { branch, branchId, format } = useBusiness()
  const [searchParams, setSearchParams] = useSearchParams()
  const [customChosen, setCustomChosen] = useState(false)

  const today = format.today()
  const month = presetRange('month', today)
  const hasPeriod = report.filters.includes('period')
  const from = searchParams.get('from') ?? month.from
  const to = searchParams.get('to') ?? month.to
  const preset: Preset = customChosen ? 'custom' : matchPreset(from, to, today)
  const param = (key: string) => searchParams.get(key) ?? ''
  const setParam = (changes: Record<string, string>) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [k, v] of Object.entries(changes)) {
          if (v) next.set(k, v)
          else next.delete(k)
        }
        return next
      },
      { replace: true },
    )

  const query: ReportQuery = {
    ...(hasPeriod ? { from, to } : {}),
    ...(report.branchScoped && branchId ? { branch: branchId } : {}),
    ...(report.filters.includes('salesGroup') ? { group: param('group') || 'day' } : {}),
    ...(report.filters.includes('expenseGroup') ? { group: param('group') || 'category' } : {}),
    ...(param('status') ? { status: param('status') } : {}),
    ...(report.filters.includes('movementType') && param('type') ? { type: param('type') } : {}),
  }
  const result = useQuery({
    queryKey: reportKeys.one(report.path, query),
    queryFn: () => fetchReport(report.path, query),
    placeholderData: keepPreviousData,
  })
  const exporting = useMutation({
    mutationFn: (fmt: 'csv' | 'pdf') => downloadReport(report.path, query, fmt),
    onSuccess: (name) => toast.success(t('reports.downloaded', { name })),
    onError: (error) => toast.error(getErrorMessage(error)),
    meta: { silentError: true },
  })

  const data = result.data
  const notes = [
    data?.note,
    ...(data?.results ?? []).map((r) => (typeof r.note === 'string' ? r.note : undefined)),
  ].filter((n, i, all): n is string => Boolean(n) && all.indexOf(n) === i)
  const currencies = new Set((data?.results ?? []).map((r) => r.currency_code).filter(Boolean))
  const scope = report.branchScoped && branch ? branch.name : t('reports.allBranches')

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <BackLink />
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">
            {t(`reports.list.${report.slug}.title`)}
          </h2>
          <p className="text-sm text-ink-muted">{t(`reports.list.${report.slug}.description`)}</p>
          <p className="mt-1 text-sm text-ink">
            {[
              report.branchScoped ? scope : t('reports.allBranchesCompared'),
              hasPeriod
                ? t('dashboard.periodLine', { from: format.date(from), to: format.date(to) })
                : data?.generated_at
                  ? t('reports.asOf', { when: format.dateTime(data.generated_at) })
                  : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={exporting.isPending && exporting.variables === 'csv'}
            disabled={!data}
            onClick={() => exporting.mutate('csv')}
            leadingIcon={<Download className="size-4" aria-hidden="true" />}
          >
            {t('reports.exportCsv')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={exporting.isPending && exporting.variables === 'pdf'}
            disabled={!data}
            onClick={() => exporting.mutate('pdf')}
            leadingIcon={<FileText className="size-4" aria-hidden="true" />}
          >
            {t('reports.exportPdf')}
          </Button>
        </div>
      </div>

      {report.filters.length > 0 && (
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          {hasPeriod && (
            <div className="max-w-full overflow-x-auto">
              <Segmented<Preset>
                label={t('dashboard.period')}
                value={preset}
                onChange={(p) => {
                  setCustomChosen(p === 'custom')
                  if (p !== 'custom') {
                    const r = presetRange(p, today)
                    setParam({ from: r.from, to: r.to })
                  }
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
          )}
          {hasPeriod && preset === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <TextField
                type="date"
                label={t('sales.from')}
                value={from}
                max={to}
                onChange={(e) => e.target.value && setParam({ from: e.target.value, to })}
              />
              <TextField
                type="date"
                label={t('sales.to')}
                value={to}
                min={from}
                max={today}
                onChange={(e) => e.target.value && setParam({ from, to: e.target.value })}
              />
            </div>
          )}
          {report.filters.includes('salesGroup') && (
            <Segmented
              label={t('reports.groupBy')}
              value={param('group') || 'day'}
              onChange={(v) => setParam({ group: v === 'day' ? '' : v })}
              options={(['day', 'week', 'month'] as const).map((g) => ({
                value: g,
                label: t(`reports.salesGroups.${g}`),
              }))}
            />
          )}
          {report.filters.includes('expenseGroup') && (
            <SelectField
              label={t('reports.groupBy')}
              className="lg:w-48"
              value={param('group') || 'category'}
              onChange={(e) =>
                setParam({ group: e.target.value === 'category' ? '' : e.target.value })
              }
            >
              {(['category', 'branch', 'month'] as const).map((g) => (
                <option key={g} value={g}>
                  {t(`reports.expenseGroups.${g}`)}
                </option>
              ))}
            </SelectField>
          )}
          {report.filters.includes('expenseStatus') && (
            <SelectField
              label={t('list.status')}
              className="lg:w-48"
              value={param('status')}
              onChange={(e) => setParam({ status: e.target.value })}
            >
              <option value="">{t('sales.allStatuses')}</option>
              {(['approved', 'pending', 'rejected'] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`expenses.status.${s}`)}
                </option>
              ))}
            </SelectField>
          )}
          {report.filters.includes('cashStatus') && (
            <SelectField
              label={t('list.status')}
              className="lg:w-48"
              value={param('status')}
              onChange={(e) => setParam({ status: e.target.value })}
            >
              <option value="">{t('sales.allStatuses')}</option>
              <option value="open">{t('cash.statusOpen')}</option>
              <option value="closed">{t('cash.statusClosed')}</option>
            </SelectField>
          )}
          {report.filters.includes('movementType') && (
            <SelectField
              label={t('stock.movementType')}
              className="lg:w-56"
              value={param('type')}
              onChange={(e) => setParam({ type: e.target.value })}
            >
              <option value="">{t('stock.allTypes')}</option>
              {MOVEMENT_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {t(`reports.movementFilters.${f.key}`)}
                </option>
              ))}
              {MOVEMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`stock.types.${type}`)}
                </option>
              ))}
            </SelectField>
          )}
        </div>
      )}

      {notes.map((note) => (
        <Alert key={note} tone="info">
          {note}
        </Alert>
      ))}
      {currencies.size > 1 && <Alert tone="info">{t('reports.severalCurrencies')}</Alert>}

      <div className={cn('flex flex-col gap-4 sm:gap-6', result.isPlaceholderData && 'opacity-60')}>
        {result.isError && !data ? (
          <Card>
            <ListError error={result.error} onRetry={() => void result.refetch()} />
          </Card>
        ) : !data ? (
          <Card>
            <ListSkeleton />
          </Card>
        ) : data.results.length === 0 ? (
          <Card>
            <EmptyState
              icon={ChartColumn}
              title={t('reports.emptyTitle')}
              description={t('reports.emptyBody')}
            />
          </Card>
        ) : (
          <>
            {report.chart && currencies.size <= 1 && (
              <Card>
                <CardHeader title={t('dashboard.netSales')} />
                <div className="p-5 pt-3 sm:px-6">
                  <Suspense
                    fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-muted" />}
                  >
                    <SalesTrendChart
                      days={data.results.map((r) => ({
                        date: String(r.period_start),
                        net_sales: String(r.net_sales),
                        transactions: Number(r.transactions),
                      }))}
                    />
                  </Suspense>
                </div>
              </Card>
            )}
            {report.layout === 'figures' ? (
              <ReportFigures report={report} rows={data.results} />
            ) : (
              <ReportTable report={report} rows={data.results} />
            )}
            {Array.isArray(data.approved_totals) && data.approved_totals.length > 0 && (
              <p className="text-sm text-ink">
                {t('reports.approvedTotal', {
                  total: (data.approved_totals as { currency_code: string; total: string }[])
                    .map((x) => format.money(x.total, { currency: x.currency_code }))
                    .join(' + '),
                })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
