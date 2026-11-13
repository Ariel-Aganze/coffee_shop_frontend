import { describe, expect, it } from 'vitest'

import type { PaymentMethodOption } from './api'
import { cashSuggestions, planPayments, type PaymentRow } from './payments'

const METHODS: PaymentMethodOption[] = [
  { code: 'cash', label: 'Cash', needs_reference: false },
  { code: 'mobile_money', label: 'Mobile Money', needs_reference: true },
]
const row = (method: PaymentRow['method'], amount: string, reference = ''): PaymentRow => ({
  key: `${method}-${amount}`,
  method,
  amount,
  reference,
})

describe('payment plan', () => {
  it('gives change for cash and records only what is kept', () => {
    const plan = planPayments([row('cash', '5000')], 4400n, 0, METHODS)
    expect(plan.issues).toEqual([])
    expect(plan.change).toBe(600n)
    expect(plan.payments).toEqual([{ method: 'cash', amount: '4400', reference: '' }])
  })

  it('splits between mobile money and cash', () => {
    const plan = planPayments(
      [row('mobile_money', '3000', 'MP1'), row('cash', '2000')],
      4400n,
      0,
      METHODS,
    )
    expect(plan.change).toBe(600n)
    expect(plan.payments).toEqual([
      { method: 'mobile_money', amount: '3000', reference: 'MP1' },
      { method: 'cash', amount: '1400', reference: '' },
    ])
  })

  it('reports what is missing', () => {
    expect(planPayments([row('cash', '1000')], 4400n, 0, METHODS).issues).toEqual([
      { kind: 'short' },
    ])
    expect(planPayments([row('cash', '1000')], 4400n, 0, METHODS).remaining).toBe(3400n)
    const noRef = planPayments([row('mobile_money', '4400')], 4400n, 0, METHODS)
    expect(noRef.issues).toEqual([{ kind: 'reference-missing', key: 'mobile_money-4400' }])
    const over = planPayments([row('mobile_money', '5000', 'MP')], 4400n, 0, METHODS)
    expect(over.issues).toContainEqual({ kind: 'non-cash-over' })
    expect(planPayments([row('cash', '12.5')], 1000n, 0, METHODS).issues[0]).toEqual({
      kind: 'amount-invalid',
      key: 'cash-12.5',
    })
  })

  it('handles currencies with decimals', () => {
    const plan = planPayments([row('cash', '20,00')], 1475n, 2, METHODS)
    expect(plan.change).toBe(525n)
    expect(plan.payments).toEqual([{ method: 'cash', amount: '14.75', reference: '' }])
  })
})

describe('cash suggestions', () => {
  it('offers the exact amount and round notes', () => {
    expect(cashSuggestions(4400n, 0)).toEqual([4400n, 4500n, 5000n, 10000n])
    expect(cashSuggestions(5000n, 0)).toEqual([5000n, 10000n])
    expect(cashSuggestions(1475n, 2)).toEqual([1475n, 1500n, 2000n, 5000n])
    expect(cashSuggestions(0n, 2)).toEqual([])
  })
})
