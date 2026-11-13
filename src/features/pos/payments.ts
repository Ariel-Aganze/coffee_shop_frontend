/**
 * Turning what the cashier typed in the checkout (one or more payment rows)
 * into what the API accepts. The backend never takes more than the amount
 * due, so cash works as "cash received": the POS shows the change to hand
 * back and sends only the amount kept.
 */
import { normalizeAmount } from '@/lib/amount'
import { fromMinor, max, sum, toMinor } from '@/lib/minor'

import type { PaymentMethod, PaymentMethodOption } from './api'

export interface PaymentRow {
  key: string
  method: PaymentMethod
  /** As typed. */
  amount: string
  reference: string
}

export type PlanIssue =
  | { kind: 'amount-invalid'; key: string }
  | { kind: 'reference-missing'; key: string }
  | { kind: 'non-cash-over' }
  | { kind: 'short' }

export interface PaymentPlan {
  paid: bigint
  remaining: bigint
  change: bigint
  issues: PlanIssue[]
  /** Ready for SaleCreateRequest.payments (only when `issues` is empty). */
  payments: { method: PaymentMethod; amount: string; reference: string }[]
}

function parse(value: string, decimals: number): bigint | null {
  const v = normalizeAmount(value)
  if (v === '') return 0n
  const pattern = decimals > 0 ? new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`) : /^\d+$/
  return pattern.test(v) ? toMinor(v, decimals) : null
}

export function planPayments(
  rows: readonly PaymentRow[],
  due: bigint,
  decimals: number,
  methods: readonly PaymentMethodOption[],
): PaymentPlan {
  const needsReference = new Set(methods.filter((m) => m.needs_reference).map((m) => m.code))
  const issues: PlanIssue[] = []
  const parsed = rows.map((row) => {
    const amount = parse(row.amount, decimals)
    if (amount === null) issues.push({ kind: 'amount-invalid', key: row.key })
    if (amount && needsReference.has(row.method) && !row.reference.trim()) {
      issues.push({ kind: 'reference-missing', key: row.key })
    }
    return { row, amount: amount ?? 0n }
  })

  const paid = sum(parsed.map((p) => p.amount))
  const nonCash = sum(parsed.filter((p) => p.row.method !== 'cash').map((p) => p.amount))
  // Only cash can be over-tendered (and handed back as change).
  if (nonCash > due) issues.push({ kind: 'non-cash-over' })
  const change = nonCash > due ? 0n : max(0n, paid - due)
  const remaining = max(0n, due - paid)
  if (remaining > 0n) issues.push({ kind: 'short' })

  // Keep the change out of what is recorded: take it off the cash rows, last first.
  let toHandBack = change
  const kept = parsed.toReversed().map((p) => {
    if (p.row.method !== 'cash' || toHandBack === 0n) return p
    const cut = p.amount < toHandBack ? p.amount : toHandBack
    toHandBack -= cut
    return { ...p, amount: p.amount - cut }
  })
  const payments = kept
    .toReversed()
    .filter((p) => p.amount > 0n)
    .map((p) => ({
      method: p.row.method,
      amount: fromMinor(p.amount, decimals),
      reference: p.row.reference.trim(),
    }))

  return { paid, remaining, change, issues, payments }
}

/**
 * Quick "cash received" amounts: the exact total, then the next round
 * amounts a customer is likely to hand over (notes of 500/1000/… for
 * currencies without decimals, 5/10/20/… otherwise).
 */
export function cashSuggestions(due: bigint, decimals: number): bigint[] {
  if (due <= 0n) return []
  const unit = 10n ** BigInt(decimals)
  const steps = (decimals === 0 ? [500n, 1000n, 5000n, 10000n] : [5n, 10n, 20n, 50n, 100n]).map(
    (s) => s * unit,
  )
  const out = [due]
  for (const step of steps) {
    const rounded = ((due + step - 1n) / step) * step
    if (!out.includes(rounded)) out.push(rounded)
    if (out.length === 4) break
  }
  return out
}
