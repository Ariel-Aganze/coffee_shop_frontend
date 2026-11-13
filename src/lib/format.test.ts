import { describe, expect, it } from 'vitest'

import { createFormatters, DEFAULT_FORMAT_SETTINGS, type FormatSettings } from './format'

const nbsp = / /g
const fmt = (overrides: Partial<FormatSettings> = {}) =>
  createFormatters({ ...DEFAULT_FORMAT_SETTINGS, ...overrides })

describe('money', () => {
  it('uses the currency precision and ISO code (RWF has no decimals)', () => {
    const f = fmt({ currencyCode: 'RWF', currencyDecimals: 0 })
    expect(f.money('1250000.0000').replace(nbsp, ' ')).toBe('RWF 1,250,000')
  })

  it('keeps 2 and 3 decimal currencies exact', () => {
    expect(fmt().money('830.5').replace(nbsp, ' ')).toBe('USD 830.50')
    const lyd = fmt({ currencyCode: 'LYD', currencyDecimals: 3 })
    expect(lyd.money('12.3456').replace(nbsp, ' ')).toBe('LYD 12.346')
  })

  it('formats huge amounts from strings without floating-point loss', () => {
    // 2^53 + 1: a JS number would round this to ...992
    expect(fmt().money('9007199254740993.00').replace(nbsp, ' ')).toBe(
      'USD 9,007,199,254,740,993.00',
    )
  })

  it('follows the business number format and handles blanks', () => {
    const f = fmt({ numberFormat: '1.234,56', currencyCode: 'EUR' })
    expect(f.money('1234.5').replace(nbsp, ' ')).toMatch(/1\.234,50/)
    expect(f.money(null)).toBe('—')
  })

  it('can show a sign for differences', () => {
    expect(fmt().money('-500', { signed: true }).replace(nbsp, ' ')).toBe('-USD 500.00')
    expect(fmt().money('500', { signed: true }).replace(nbsp, ' ')).toBe('+USD 500.00')
  })
})

describe('dates', () => {
  const instant = '2026-11-12T22:30:00Z' // 00:30 on the 13th in Kigali (UTC+2)

  it('shows dates and times in the business timezone', () => {
    const f = fmt({ timezone: 'Africa/Kigali' })
    expect(f.date(instant)).toBe('2026-11-13')
    expect(f.time(instant)).toBe('00:30')
    expect(fmt({ timezone: 'UTC' }).date(instant)).toBe('2026-11-12')
  })

  it('follows the business date format', () => {
    expect(fmt({ dateFormat: 'DD/MM/YYYY' }).date('2026-03-04')).toBe('04/03/2026')
    expect(fmt({ dateFormat: 'MM/DD/YYYY' }).date('2026-03-04')).toBe('03/04/2026')
    expect(fmt({ dateFormat: 'DD MMM YYYY' }).date('2026-03-04')).toBe('04 Mar 2026')
  })

  it('never shifts a calendar date across timezones', () => {
    expect(fmt({ timezone: 'Pacific/Honolulu' }).date('2026-03-04')).toBe('2026-03-04')
    expect(fmt({ timezone: 'Pacific/Kiritimati' }).date('2026-03-04')).toBe('2026-03-04')
  })

  it('falls back to UTC for an unknown timezone and handles blanks', () => {
    expect(fmt({ timezone: 'Mars/Olympus' }).timeZone).toBe('UTC')
    expect(fmt().date(null)).toBe('—')
    expect(fmt().date('not a date')).toBe('—')
  })
})
