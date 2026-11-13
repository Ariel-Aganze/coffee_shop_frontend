import { describe, expect, it } from 'vitest'

import { fromMinor, percentOf, sum, times, toMinor } from './minor'

describe('minor-unit money', () => {
  it('converts API decimals both ways', () => {
    expect(toMinor('2200.0000', 0)).toBe(2200n)
    expect(toMinor('3.2500', 2)).toBe(325n)
    expect(toMinor('0.1', 2)).toBe(10n)
    expect(toMinor('1.005', 2)).toBe(101n) // half-up
    expect(toMinor('-4.50', 2)).toBe(-450n)
    expect(fromMinor(325n, 2)).toBe('3.25')
    expect(fromMinor(5n, 2)).toBe('0.05')
    expect(fromMinor(2200n, 0)).toBe('2200')
    expect(fromMinor(-450n, 2)).toBe('-4.50')
    expect(() => toMinor('1,5', 2)).toThrow('Not a decimal amount')
  })

  it('adds without float drift', () => {
    // 0.1 + 0.2 in floats is 0.30000000000000004
    expect(fromMinor(sum([toMinor('0.1', 2), toMinor('0.2', 2)]), 2)).toBe('0.30')
    expect(fromMinor(times(toMinor('19.99', 2), 3), 2)).toBe('59.97')
  })

  it('takes percentages half-up', () => {
    expect(percentOf(4400n, '10.00')).toBe(440n)
    expect(percentOf(2225n, '10')).toBe(223n) // 222.5 → 223
    expect(percentOf(999n, '0')).toBe(0n)
  })
})
