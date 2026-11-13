import { describe, expect, it } from 'vitest'

import { amountSchema, marginRatio, normalizeAmount, toInputAmount } from '@/lib/amount'

describe('amount inputs', () => {
  it('accepts a comma as the decimal mark', () => {
    expect(normalizeAmount(' 2500,5 ')).toBe('2500.5')
    expect(normalizeAmount('2500.50')).toBe('2500.50')
  })

  it('respects the currency precision', () => {
    const rwf = amountSchema(0)
    expect(rwf.safeParse('2500').success).toBe(true)
    expect(rwf.safeParse('2500.5').error?.issues[0]?.message).toBe('products.amountWhole')
    const usd = amountSchema(2)
    expect(usd.parse('3,25')).toBe('3.25')
    expect(usd.safeParse('3.255').success).toBe(false)
    expect(usd.safeParse('1,000.00').success).toBe(false) // no grouping
    expect(usd.safeParse('-1').success).toBe(false)
    expect(usd.safeParse('').error?.issues[0]?.message).toBe('products.amountRequired')
    expect(amountSchema(2, { required: false }).safeParse('').success).toBe(true)
  })

  it('tidies API decimals for editing', () => {
    expect(toInputAmount('2200.0000')).toBe('2200')
    expect(toInputAmount('2.5000')).toBe('2.5')
    expect(toInputAmount('100')).toBe('100')
    expect(toInputAmount(null)).toBe('')
  })

  it('works out the margin only when it makes sense', () => {
    expect(marginRatio('2000.0000', '500.0000')).toBe(0.75)
    expect(marginRatio('0', '0')).toBeNull()
    expect(marginRatio('2000', undefined)).toBeNull()
    expect(marginRatio(null, '1')).toBeNull()
  })
})
