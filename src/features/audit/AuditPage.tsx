import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ListError, ListSkeleton } from '@/components/feedback/ListStates'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { SelectField } from '@/components/ui/SelectField'
import { Table, Td, Th } from '@/components/ui/Table'
import { TextField } from '@/components/ui/TextField'
import { useBusiness, useFormat } from '@/features/business/useBusiness'
import { useListParams } from '@/hooks/useListParams'
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery'

import {
  auditKeys,
  fetchAuditActions,
  fetchAuditPage,
  humanize,
  targetLink,
  type AuditEntry,
  type AuditListParams,
} from './api'

/** Translated action name, or a readable version of its code. */
function useActionLabel() {
  const { t, i18n } = useTranslation()
  return (code: string) =>
    i18n.exists(`audit.actions.${code}`) ? t(`audit.actions.${code}` as never) : humanize(code)
}

/** The affected record, linked when it has a page. */
const target = (e: AuditEntry) => {
  if (!e.target_type) return <span className="text-ink-subtle">—</span>
  const text = `${e.target_type} #${e.target_id}`
  const to = targetLink(e)
  return to ? (
    <Link to={to} className="text-primary hover:underline">
      {text}
    </Link>
  ) : (
    text
  )
}

/** Audit trail (SRS 5.16, AUD-009/010): who did what, where, when. Read-only. */
export function AuditPage() {
  const { t } = useTranslation()
  const { branchId, format } = useBusiness()
  const isDesktop = useMediaQuery(MD_UP)
  const label = useActionLabel()
  const { filters, setFilter, hasActiveFilters, page, pageSize, setPage, setPageSize } =
    useListParams(['search', 'action', 'from', 'to'] as const)
  const [selected, setSelected] = useState<AuditEntry | null>(null)

  const params: AuditListParams = {
    page,
    page_size: pageSize,
    ...(branchId ? { branch: branchId } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  }
  const query = useQuery({
    queryKey: auditKeys.list(params),
    queryFn: () => fetchAuditPage(params),
    placeholderData: keepPreviousData,
  })
  const actions = useQuery({
    queryKey: auditKeys.actions,
    queryFn: fetchAuditActions,
    staleTime: 300_000,
  })

  const who = (e: AuditEntry) =>
    e.user ? (
      <>
        <span className="block text-ink">{e.user.name}</span>
        <span className="block text-xs text-ink-muted">{t(`roles.${e.user.role}` as never)}</span>
      </>
    ) : (
      <span className="text-ink-muted">{t('audit.system')}</span>
    )

  const data = query.data
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3">
        <SearchInput
          className="md:max-w-md"
          label={t('audit.search')}
          value={filters.search}
          onChange={(v) => setFilter('search', v)}
        />
        <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end">
          <SelectField
            label={t('audit.action')}
            className="col-span-2 md:w-64"
            value={filters.action}
            onChange={(e) => setFilter('action', e.target.value)}
          >
            <option value="">{t('audit.allActions')}</option>
            {(actions.data ?? []).map((code) => (
              <option key={code} value={code}>
                {label(code)}
              </option>
            ))}
          </SelectField>
          <TextField
            type="date"
            label={t('sales.from')}
            className="md:w-44"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => setFilter('from', e.target.value)}
          />
          <TextField
            type="date"
            label={t('sales.to')}
            className="md:w-44"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => setFilter('to', e.target.value)}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ListError error={query.error} onRetry={() => void query.refetch()} />
        ) : data && data.results.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={hasActiveFilters ? t('list.noMatchTitle') : t('audit.emptyTitle')}
            description={hasActiveFilters ? t('list.noMatchBody') : t('audit.emptyBody')}
          />
        ) : (
          data &&
          (isDesktop ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t('audit.when')}</Th>
                  <Th>{t('audit.action')}</Th>
                  <Th>{t('audit.who')}</Th>
                  <Th className="hidden lg:table-cell">{t('audit.record')}</Th>
                  <Th className="hidden xl:table-cell">{t('sales.branch')}</Th>
                  <Th className="text-right">
                    <span className="sr-only">{t('list.actions')}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-muted/60">
                    <Td className="whitespace-nowrap text-ink-muted">
                      {format.dateTime(e.created_at)}
                    </Td>
                    <Td className="font-medium text-ink">{label(e.action)}</Td>
                    <Td>{who(e)}</Td>
                    <Td className="hidden lg:table-cell">{target(e)}</Td>
                    <Td className="hidden text-ink-muted xl:table-cell">{e.branch?.name ?? '—'}</Td>
                    <Td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(e)}>
                        {t('audit.details')}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <ul className="divide-y divide-border">
              {data.results.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1 p-4 text-left hover:bg-surface-muted/60"
                    onClick={() => setSelected(e)}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-medium text-ink">{label(e.action)}</span>
                      <span className="shrink-0 text-xs text-ink-muted">
                        {format.dateTime(e.created_at)}
                      </span>
                    </span>
                    <span className="text-sm text-ink-muted">
                      {[
                        e.user?.name ?? t('audit.system'),
                        e.branch?.name,
                        e.target_type && `${e.target_type} #${e.target_id}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </button>
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

      <AuditDetail entry={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

/** Values as readable text: nested objects as JSON. */
const show = (value: unknown) =>
  value === null || value === undefined || value === ''
    ? '—'
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)

const asRecord = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

function KeyValues({ title, values }: { title: string; values: Record<string, unknown> }) {
  const entries = Object.entries(values)
  if (entries.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl bg-surface-muted p-3 text-sm">
        {entries.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="truncate text-ink-muted">{humanize(key)}</dt>
            <dd className="break-words text-ink">{show(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function AuditDetail({ entry, onClose }: { entry: AuditEntry | null; onClose: () => void }) {
  const { t } = useTranslation()
  const format = useFormat()
  const label = useActionLabel()
  if (!entry) return null
  const to = targetLink(entry)
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={label(entry.action)}
      description={[
        format.dateTime(entry.created_at),
        entry.user ? `${entry.user.name} (${entry.user.username})` : t('audit.system'),
        entry.branch?.name,
      ]
        .filter(Boolean)
        .join(' · ')}
    >
      <div className="flex flex-col gap-4">
        {entry.target_type && (
          <p className="text-sm text-ink">
            {t('audit.record')}:{' '}
            {to ? (
              <Link to={to} className="text-primary hover:underline" onClick={onClose}>
                {entry.target_type} #{entry.target_id}
              </Link>
            ) : (
              `${entry.target_type} #${entry.target_id}`
            )}
          </p>
        )}
        <KeyValues title={t('audit.detailsTitle')} values={asRecord(entry.metadata)} />
        <KeyValues title={t('audit.before')} values={asRecord(entry.previous_value)} />
        <KeyValues title={t('audit.after')} values={asRecord(entry.new_value)} />
      </div>
    </Dialog>
  )
}
