import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useFormat } from '@/features/business/useBusiness'

import type { DashTrendDay } from './api'

// One series, so one hue (the brand primary) and no legend: the card title names it.
const BAR = 'var(--color-primary)'
const GRID = 'var(--color-border)'
const TICK = 'var(--color-ink-muted)'

/** "13 Nov": a calendar day, so formatted in UTC (no zone shift). */
const dayLabel = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  )

type TrendPoint = DashTrendDay & { value: number }

/** Hover box for a bar (Recharts injects `active` and `payload`). */
function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: readonly { payload?: unknown }[]
}) {
  const { t } = useTranslation()
  const format = useFormat()
  const day = active ? (payload?.[0]?.payload as TrendPoint | undefined) : undefined
  if (!day) return null
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm shadow-pop">
      <p className="font-medium text-ink">{format.date(day.date)}</p>
      <p className="text-ink tabular-nums">{format.money(day.net_sales)}</p>
      <p className="text-xs text-ink-muted">
        {t('dashboard.transactionsCount', { count: day.transactions })}
      </p>
    </div>
  )
}

/** Net sales per day for the selected period, with a table view for screen readers. */
export function SalesTrendChart({ days }: { days: DashTrendDay[] }) {
  const { t, i18n } = useTranslation()
  const format = useFormat()
  const tableId = useId()
  const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-GB'
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
  const data: TrendPoint[] = days.map((d) => ({ ...d, value: Number(d.net_sales) }))

  return (
    <figure className="flex flex-col gap-2">
      <div className="h-64 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="0" />
            <XAxis
              dataKey="date"
              tickFormatter={(iso: string) => dayLabel(iso, locale)}
              tick={{ fill: TICK, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              minTickGap={12}
            />
            <YAxis
              tickFormatter={(v: number) => compact.format(v)}
              tick={{ fill: TICK, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip cursor={{ fill: 'var(--color-surface-muted)' }} content={<TrendTooltip />} />
            <Bar
              dataKey="value"
              fill={BAR}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-ink-muted hover:text-ink">
          {t('dashboard.showTable')}
        </summary>
        <table id={tableId} className="mt-2 w-full text-left">
          <thead>
            <tr className="text-xs text-ink-muted uppercase">
              <th className="py-1 font-medium">{t('dashboard.day')}</th>
              <th className="py-1 text-right font-medium">{t('dashboard.netSales')}</th>
              <th className="py-1 text-right font-medium">{t('dashboard.transactions')}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} className="border-t border-border">
                <td className="py-1">{format.date(d.date)}</td>
                <td className="py-1 text-right tabular-nums">{format.money(d.net_sales)}</td>
                <td className="py-1 text-right tabular-nums">{d.transactions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
