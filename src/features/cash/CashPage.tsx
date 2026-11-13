import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Banknote } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ListError, ListSkeleton } from '@/components/feedback/ListStates'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { Segmented } from '@/components/ui/Segmented'
import { Table, Td, Th } from '@/components/ui/Table'
import { can } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useBusiness } from '@/features/business/useBusiness'
import { useListParams } from '@/hooks/useListParams'
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'

import {
  cashKeys,
  fetchMyOpenSession,
  fetchSessionPage,
  type CashSession,
  type SessionListParams,
} from './api'
import { OpenDrawerDialog } from './OpenDrawerDialog'

type Status = 'open' | 'closed' | 'all'

const sessionLink = (s: CashSession) => (
  <Link to={`/cash/${s.id}`} className="font-medium text-ink hover:text-primary hover:underline">
    {s.cashier_name}
  </Link>
)

/** Cash sessions (SRS 5.10): your drawer at this branch, and the history. */
export function CashPage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { branch, branchId, format } = useBusiness()
  const isDesktop = useMediaQuery(MD_UP)
  const { filters, setFilter, page, pageSize, setPage, setPageSize } = useListParams(
    ['status'] as const,
    { status: 'all' },
  )
  const status = (filters.status as Status) || 'all'
  const sells = can(user.role, 'pos.use')

  const params: SessionListParams = {
    page,
    page_size: pageSize,
    ...(branchId ? { branch: branchId } : {}),
    ...(status !== 'all' ? { status } : {}),
  }
  const query = useQuery({
    queryKey: cashKeys.list(params),
    queryFn: () => fetchSessionPage(params),
    placeholderData: keepPreviousData,
  })
  const mine = useQuery({
    queryKey: cashKeys.mine(branchId ?? 0, user.id),
    queryFn: () => fetchMyOpenSession(branchId!, user.id),
    enabled: sells && branchId !== null,
  })
  const [opening, setOpening] = useState(false)

  const money = (s: CashSession, v: string | null) =>
    format.money(v, { currency: s.currency_code, decimals: s.currency_decimal_places })
  const differenceCell = (s: CashSession) => {
    if (s.difference === null) return <span className="text-ink-subtle">—</span>
    const d = Number(s.difference)
    return (
      <span
        className={cn(
          'font-medium tabular-nums',
          d === 0 ? 'text-success' : d > 0 ? 'text-warning' : 'text-danger',
        )}
      >
        {d > 0 ? '+' : ''}
        {money(s, s.difference)}
      </span>
    )
  }
  const statusBadge = (s: CashSession) =>
    s.status === 'open' ? (
      <Badge tone="success" dot>
        {t('cash.statusOpen')}
      </Badge>
    ) : (
      <Badge tone="neutral">{t('cash.statusClosed')}</Badge>
    )

  const data = query.data
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {sells && branch && (
        <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-peach text-primary">
              <Banknote className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-ink">
                {t('cash.myDrawer', { branch: branch.name })}
              </p>
              <p className="text-sm text-ink-muted">
                {mine.isPending
                  ? t('app.loading')
                  : mine.data
                    ? t('cash.myDrawerOpen', {
                        since: format.dateTime(mine.data.opened_at),
                        cash: money(mine.data, mine.data.live_expected_cash),
                      })
                    : t('cash.myDrawerClosed')}
              </p>
            </div>
          </div>
          {mine.data ? (
            <Link
              to={`/cash/${mine.data.id}`}
              className="inline-flex h-11 items-center justify-center rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover"
            >
              {t('cash.manage')}
            </Link>
          ) : (
            !mine.isPending && <Button onClick={() => setOpening(true)}>{t('cash.open')}</Button>
          )}
        </Card>
      )}

      <Segmented
        className="self-start"
        label={t('list.status')}
        value={status}
        onChange={(v) => setFilter('status', v)}
        options={[
          { value: 'all', label: t('list.statusAll') },
          { value: 'open', label: t('cash.statusOpen') },
          { value: 'closed', label: t('cash.statusClosed') },
        ]}
      />

      <Card className="overflow-hidden">
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        ) : data && data.results.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title={t('cash.emptyTitle')}
            description={t('cash.emptyBody')}
          />
        ) : (
          data &&
          (isDesktop ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t('cash.cashier')}</Th>
                  {branchId === null && <Th>{t('sales.branch')}</Th>}
                  <Th>{t('cash.openedAt')}</Th>
                  <Th className="hidden text-right lg:table-cell">{t('cash.opening')}</Th>
                  <Th className="text-right">{t('cash.expected')}</Th>
                  <Th className="hidden text-right xl:table-cell">{t('cash.counted')}</Th>
                  <Th className="text-right">{t('cash.difference')}</Th>
                  <Th>{t('list.status')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-muted/60">
                    <Td>{sessionLink(s)}</Td>
                    {branchId === null && <Td className="text-ink-muted">{s.branch_name}</Td>}
                    <Td className="whitespace-nowrap text-ink-muted">
                      {format.dateTime(s.opened_at)}
                    </Td>
                    <Td className="hidden text-right tabular-nums lg:table-cell">
                      {money(s, s.opening_balance)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {money(s, s.expected_cash ?? s.live_expected_cash)}
                    </Td>
                    <Td className="hidden text-right tabular-nums xl:table-cell">
                      {money(s, s.actual_cash)}
                    </Td>
                    <Td className="text-right">{differenceCell(s)}</Td>
                    <Td>{statusBadge(s)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <ul className="divide-y divide-border">
              {data.results.map((s) => (
                <li key={s.id} className="flex flex-col gap-1.5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    {sessionLink(s)}
                    {statusBadge(s)}
                  </div>
                  <p className="text-sm text-ink-muted">
                    {[format.dateTime(s.opened_at), branchId === null ? s.branch_name : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="flex justify-between text-sm">
                    <span className="text-ink-muted">
                      {t('cash.expected')}: {money(s, s.expected_cash ?? s.live_expected_cash)}
                    </span>
                    {differenceCell(s)}
                  </p>
                </li>
              ))}
            </ul>
          ))
        )}
      </Card>

      {data && data.count > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          count={data.count}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
      {branch && (
        <OpenDrawerDialog open={opening} onClose={() => setOpening(false)} branch={branch} />
      )}
    </div>
  )
}
