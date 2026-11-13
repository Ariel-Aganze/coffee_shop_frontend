import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Pagination } from '@/components/ui/Pagination'
import { Table, Td, Th } from '@/components/ui/Table'
import { useFormat } from '@/features/business/useBusiness'
import { useQuantity } from '@/features/inventory/useQuantity'
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import { fromMinor, sum, toMinor } from '@/lib/minor'

import type { ReportRow } from './api'
import type { Column, ReportDef } from './catalog'

const HIDE = { lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' } as const
const NUMERIC = new Set(['money', 'int', 'qty', 'signedQty', 'signedMoney'])

/** Format one cell according to its column kind. */
function useCell() {
  const { t } = useTranslation()
  const format = useFormat()
  const quantity = useQuantity()
  return (row: ReportRow, col: Column): ReactNode => {
    const value = row[col.key]
    if (value === null || value === undefined || value === '') {
      return <span className="text-ink-subtle">—</span>
    }
    const currency = typeof row.currency_code === 'string' ? row.currency_code : undefined
    switch (col.kind) {
      case 'money':
        return format.money(String(value), { currency })
      case 'signedMoney': {
        const n = Number(value)
        return (
          <span className={cn(n < 0 && 'text-danger')}>
            {format.money(String(value), { currency, signed: true })}
          </span>
        )
      }
      case 'int':
        return format.number(String(value))
      case 'qty':
        return quantity(String(value), String(row.unit ?? 'each'))
      case 'signedQty': {
        const n = Number(value)
        return (
          <span className={n > 0 ? 'text-success' : 'text-danger'}>
            {n > 0 ? '+' : '−'}
            {quantity(String(Math.abs(n)), String(row.unit ?? 'each'))}
          </span>
        )
      }
      case 'date':
        return format.date(String(value))
      case 'datetime':
        return format.dateTime(String(value))
      case 'period': {
        const start = String(row.period_start)
        const end = String(row.period_end)
        return start === end ? format.date(start) : `${format.date(start)} – ${format.date(end)}`
      }
      case 'badge':
        return <Badge>{t(`${col.badge}.${String(value)}` as never)}</Badge>
      default:
        return String(value)
    }
  }
}

/** Sum a money/int column when every row is in one currency (else no totals). */
function totalOf(rows: ReportRow[], col: Column, decimals: number): string | null {
  const values = rows.map((r) => r[col.key]).filter((v) => v !== null && v !== undefined)
  if (col.kind === 'int') return String(values.reduce((n: number, v) => n + Number(v), 0))
  return fromMinor(
    sum(values.map((v) => toMinor(String(v), Math.max(decimals, 4)))),
    Math.max(decimals, 4),
  )
}

/** Secondary text under a cell (e.g. the SKU under a product). */
const subText = (row: ReportRow, col: Column) =>
  col.sub && row[col.sub] ? (
    <span className="block text-xs text-ink-muted">{String(row[col.sub])}</span>
  ) : null

/** Report results as a table (cards on phones), 50 rows per page, with totals. */
export function ReportTable({ report, rows }: { report: ReportDef; rows: ReportRow[] }) {
  const { t } = useTranslation()
  const format = useFormat()
  const cell = useCell()
  const isDesktop = useMediaQuery(MD_UP)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  // Back to the first page whenever the results change (new filters).
  const [forRows, setForRows] = useState(rows)
  if (rows !== forRows) {
    setForRows(rows)
    setPage(1)
  }

  const label = (key: string) => t(`reports.columns.${key}` as never)
  const visible = rows.slice((page - 1) * pageSize, page * pageSize)
  const singleCurrency = new Set(rows.map((r) => r.currency_code ?? '')).size <= 1
  const showTotals = singleCurrency && rows.length > 1 && report.columns.some((c) => c.total)
  const totalsRow: ReportRow = { currency_code: rows[0]?.currency_code }
  for (const col of report.columns) {
    if (col.total) totalsRow[col.key] = totalOf(rows, col, format.settings.currencyDecimals)
  }
  const [first, ...rest] = report.columns

  return (
    <>
      <Card className="overflow-hidden">
        {isDesktop ? (
          <Table>
            <thead>
              <tr>
                {report.columns.map((col) => (
                  <Th
                    key={col.key}
                    className={cn(
                      NUMERIC.has(col.kind) && 'text-right',
                      col.hideBelow && HIDE[col.hideBelow],
                    )}
                  >
                    {label(col.key)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => (
                <tr key={i}>
                  {report.columns.map((col, c) => (
                    <Td
                      key={col.key}
                      className={cn(
                        NUMERIC.has(col.kind) && 'text-right whitespace-nowrap tabular-nums',
                        col.kind === 'datetime' && 'whitespace-nowrap text-ink-muted',
                        c === 0 && 'font-medium text-ink',
                        col.hideBelow && HIDE[col.hideBelow],
                      )}
                    >
                      {cell(row, col)}
                      {subText(row, col)}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
            {showTotals && (
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-muted/60 font-semibold">
                  {report.columns.map((col, c) => (
                    <Td
                      key={col.key}
                      className={cn(
                        NUMERIC.has(col.kind) && 'text-right whitespace-nowrap tabular-nums',
                        col.hideBelow && HIDE[col.hideBelow],
                      )}
                    >
                      {c === 0 ? t('reports.total') : col.total ? cell(totalsRow, col) : null}
                    </Td>
                  ))}
                </tr>
              </tfoot>
            )}
          </Table>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((row, i) => (
              <li key={i} className="flex flex-col gap-2 p-4">
                <p className="font-medium text-ink">
                  {cell(row, first!)}
                  {subText(row, first!)}
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {rest.map((col) => (
                    <div key={col.key} className="contents">
                      <dt className="text-ink-muted">{label(col.key)}</dt>
                      <dd className="text-right text-ink tabular-nums">
                        {cell(row, col)}
                        {subText(row, col)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
            {showTotals && (
              <li className="flex flex-col gap-2 bg-surface-muted/60 p-4">
                <p className="font-semibold text-ink">{t('reports.total')}</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {rest
                    .filter((c) => c.total)
                    .map((col) => (
                      <div key={col.key} className="contents">
                        <dt className="text-ink-muted">{label(col.key)}</dt>
                        <dd className="text-right font-semibold text-ink tabular-nums">
                          {cell(totalsRow, col)}
                        </dd>
                      </div>
                    ))}
                </dl>
              </li>
            )}
          </ul>
        )}
      </Card>
      {rows.length > 50 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          count={rows.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      )}
    </>
  )
}

/** One-row summaries (one card per currency) as labelled figures. */
export function ReportFigures({ report, rows }: { report: ReportDef; rows: ReportRow[] }) {
  const { t } = useTranslation()
  const cell = useCell()
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row, i) => (
        <Card key={i} className="p-5 sm:p-6">
          {rows.length > 1 && (
            <p className="mb-3 text-sm font-medium text-ink-muted">{String(row.currency_code)}</p>
          )}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            {report.columns.map((col, c) => (
              <div key={col.key}>
                <dt className="text-sm text-ink-muted">
                  {t(`reports.columns.${col.key}` as never)}
                </dt>
                <dd
                  className={cn(
                    'tabular-nums',
                    c === 0 ? 'text-2xl font-semibold text-ink' : 'text-lg font-semibold text-ink',
                  )}
                >
                  {cell(row, col)}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
    </div>
  )
}
