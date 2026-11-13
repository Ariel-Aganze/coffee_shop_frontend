import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListError, ListSkeleton } from '@/components/feedback/ListStates'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { TextField } from '@/components/ui/TextField'
import { useBusiness } from '@/features/business/useBusiness'
import { getErrorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/cn'

import {
  asUnit,
  fetchAllStock,
  invalidateStock,
  stockKeys,
  submitCount,
  type CountResult,
  type StockRow,
} from './api'
import { InventoryTabs } from './InventoryTabs'
import { parseQuantity, useQuantity } from './useQuantity'

const draftKey = (branch: number) => `caffio.stockcount.${branch}`

function loadDraft(branch: number): Record<number, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(draftKey(branch)) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<number, string>) : {}
  } catch {
    return {}
  }
}

/** Physical stock count (INV-017, INV-018): count, compare, post the differences. */
export function StockCountPage() {
  const { t } = useTranslation()
  const { branch, branches, setBranchId } = useBusiness()
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <InventoryTabs />
      {branch ? (
        <CountSheet key={branch.id} branch={branch} />
      ) : (
        <Card className="mx-auto w-full max-w-lg p-6">
          <EmptyState
            icon={Store}
            title={t('stock.countChooseBranch')}
            description={t('stock.countChooseBranchBody')}
          />
          <ul className="mt-2 flex flex-col gap-2">
            {branches.map((b) => (
              <li key={b.id}>
                <Button variant="secondary" className="w-full" onClick={() => setBranchId(b.id)}>
                  {b.name}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function CountSheet({ branch }: { branch: { id: number; name: string } }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const quantity = useQuantity()
  const rows = useQuery({
    queryKey: stockKeys.countSheet(branch.id),
    queryFn: () => fetchAllStock(branch.id),
  })
  const [counts, setCounts] = useState<Record<number, string>>(() => loadDraft(branch.id))
  const [reason, setReason] = useState('')
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState<{ reason?: string; lines?: string }>({})
  const [result, setResult] = useState<CountResult | null>(null)

  useEffect(() => {
    try {
      if (Object.keys(counts).length)
        localStorage.setItem(draftKey(branch.id), JSON.stringify(counts))
      else localStorage.removeItem(draftKey(branch.id))
    } catch {
      // storage unavailable: the draft just won't survive a reload
    }
  }, [branch.id, counts])

  const submit = useMutation({
    mutationFn: submitCount,
    onSuccess: (data) => {
      setResult(data)
      setCounts({})
      setReason('')
      invalidateStock(queryClient, branch.id)
    },
    meta: { silentError: true },
  })

  if (rows.isPending) return <ListSkeleton />
  if (rows.isError) return <ListError error={rows.error} onRetry={() => void rows.refetch()} />

  if (result) {
    const changed = result.lines.filter((l) => Number(l.difference) !== 0)
    return (
      <Card>
        <CardHeader
          title={t('stock.countDone', { count: result.adjusted })}
          description={t('stock.countDoneBody', { branch: branch.name })}
        />
        <ul className="divide-y divide-border px-5 py-2 sm:px-6">
          {changed.length === 0 ? (
            <li className="py-3 text-sm text-ink-muted">{t('stock.countAllMatched')}</li>
          ) : (
            changed.map((line) => (
              <li key={line.product} className="flex justify-between gap-3 py-3 text-sm">
                <span className="font-medium text-ink">{line.product_name}</span>
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    Number(line.difference) > 0 ? 'text-success' : 'text-danger',
                  )}
                >
                  {Number(line.difference) > 0 ? '+' : ''}
                  {Number(line.difference).toLocaleString()}
                </span>
              </li>
            ))
          )}
        </ul>
        <div className="flex justify-end px-5 pb-5 sm:px-6">
          <Button onClick={() => setResult(null)}>{t('stock.countAgain')}</Button>
        </div>
      </Card>
    )
  }

  const all = rows.data
  const query = search.trim().toLowerCase()
  const visible = all.filter(
    (r) =>
      !query ||
      r.product_name.toLowerCase().includes(query) ||
      r.product_sku.toLowerCase().includes(query),
  )
  const filled = all.filter((r) => (counts[r.product] ?? '').trim() !== '')
  const invalid = filled.filter((r) => parseQuantity(counts[r.product]!, r.product_unit) === null)
  const differences = filled.filter(
    (r) =>
      !invalid.includes(r) &&
      Number(parseQuantity(counts[r.product]!, r.product_unit)) !== Number(r.quantity),
  )

  function confirm() {
    const next: typeof errors = {}
    if (filled.length === 0) next.lines = t('stock.countNothing')
    else if (invalid.length) next.lines = t('stock.countInvalid', { count: invalid.length })
    if (!reason.trim()) next.reason = t('stock.reasonRequired')
    setErrors(next)
    if (Object.keys(next).length) return
    submit.mutate({
      branch: branch.id,
      reason: reason.trim(),
      lines: filled.map((r) => ({
        product_id: r.product,
        counted_quantity: parseQuantity(counts[r.product]!, r.product_unit)!,
      })),
    })
  }

  const diffCell = (row: StockRow) => {
    const raw = counts[row.product] ?? ''
    if (!raw.trim()) return <span className="text-ink-subtle">—</span>
    const parsed = parseQuantity(raw, row.product_unit)
    if (parsed === null) return <span className="text-danger">{t('stock.countBad')}</span>
    // Display only; at most 3 decimals, so rounding away float noise is exact enough.
    const diff = Math.round((Number(parsed) - Number(row.quantity)) * 1000) / 1000
    return (
      <span
        className={cn(
          'font-semibold tabular-nums',
          diff === 0 ? 'text-success' : diff > 0 ? 'text-warning' : 'text-danger',
        )}
      >
        {diff === 0 ? t('stock.countMatches') : `${diff > 0 ? '+' : ''}${diff.toLocaleString()}`}
      </span>
    )
  }

  if (all.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ClipboardCheck}
          title={t('stock.emptyTitle')}
          description={t('stock.countEmptyBody')}
        />
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader
          title={t('stock.countTitle', { branch: branch.name })}
          description={t('stock.countBody')}
        />
        <div className="flex flex-col gap-3 p-5 pt-4 sm:px-6">
          <SearchInput
            className="md:max-w-sm"
            label={t('stock.search')}
            value={search}
            onChange={setSearch}
            debounceMs={0}
          />
          <ul className="divide-y divide-border">
            {visible.map((row) => {
              const unit = asUnit(row.product_unit)
              return (
                <li
                  key={row.product}
                  className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_6rem]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{row.product_name}</p>
                    <p className="text-xs text-ink-muted">{row.product_sku}</p>
                  </div>
                  <p className="hidden text-right text-sm text-ink-muted tabular-nums sm:block">
                    {quantity(row.quantity, row.product_unit)}
                  </p>
                  <TextField
                    label={t('stock.countedLabel', { name: row.product_name })}
                    className="[&>label]:sr-only"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={t(`units.symbol.${unit}`)}
                    value={counts[row.product] ?? ''}
                    onChange={(e) =>
                      setCounts((c) => {
                        const next = { ...c, [row.product]: e.target.value }
                        if (!e.target.value) delete next[row.product]
                        return next
                      })
                    }
                  />
                  <p className="col-span-2 text-sm sm:col-span-1 sm:text-right">
                    <span className="text-ink-muted sm:hidden">
                      {t('stock.recordedShort', {
                        quantity: quantity(row.quantity, row.product_unit),
                      })}{' '}
                    </span>
                    {diffCell(row)}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>
      </Card>

      <Card className="sticky bottom-3 z-10 p-4 sm:p-5">
        {submit.isError && (
          <Alert tone="danger" className="mb-3">
            {getErrorMessage(submit.error)}
          </Alert>
        )}
        {errors.lines && (
          <Alert tone="danger" className="mb-3">
            {errors.lines}
          </Alert>
        )}
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <TextField
            className="md:flex-1"
            label={t('stock.reason')}
            placeholder={t('stock.countReasonPlaceholder')}
            autoComplete="off"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={errors.reason}
          />
          <p className="text-sm text-ink-muted md:pb-3">
            {t('stock.countProgress', {
              counted: filled.length,
              total: all.length,
              differences: differences.length,
            })}
          </p>
          <Button loading={submit.isPending} onClick={confirm}>
            {t('stock.countSubmit')}
          </Button>
        </div>
      </Card>
    </>
  )
}
