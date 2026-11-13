/**
 * Money, number and date formatting driven by the business settings
 * (currency, timezone, number format, date format — SRS 5.14, NFR-039..043).
 *
 * Money arrives from the API as decimal strings ("1250000.0000"). They are
 * formatted as strings so no amount ever passes through floating point
 * (CUR-024), rounded to the currency's precision, and shown with the ISO code
 * so currencies sharing a symbol can't be confused (CUR-021, CUR-022).
 */

export interface FormatSettings {
  currencyCode: string
  currencyDecimals: number
  timezone: string
  /** Business setting such as "1,234.56" or "1.234,56". */
  numberFormat: string
  /** Business setting such as "YYYY-MM-DD" or "DD/MM/YYYY". */
  dateFormat: string
  language: string
}

export const DEFAULT_FORMAT_SETTINGS: FormatSettings = {
  currencyCode: 'USD',
  currencyDecimals: 2,
  timezone: 'UTC',
  numberFormat: '1,234.56',
  dateFormat: 'YYYY-MM-DD',
  language: 'en',
}

/** Which locale's digit grouping matches each number-format setting. */
const NUMBER_LOCALES: Record<string, string> = {
  '1,234.56': 'en-US',
  '1.234,56': 'de-DE',
  '1 234,56': 'fr-FR',
  "1'234.56": 'de-CH',
}

type Numeric = string | number | null | undefined

// Intl accepts decimal strings ("1250000.5000") and formats them exactly.
type IntlValue = Parameters<Intl.NumberFormat['format']>[0]
const exact = (value: string | number) => value as IntlValue

function toZone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: timezone }).resolvedOptions().timeZone
  } catch {
    return 'UTC' // unknown timezone name
  }
}

const isBlank = (v: Numeric): v is null | undefined | '' =>
  v === null || v === undefined || v === ''

export function createFormatters(settings: FormatSettings) {
  const numberLocale = NUMBER_LOCALES[settings.numberFormat] ?? 'en-US'
  const textLocale = settings.language === 'fr' ? 'fr-FR' : 'en-GB'
  const timeZone = toZone(settings.timezone)

  function money(
    amount: Numeric,
    options: { currency?: string; decimals?: number; signed?: boolean } = {},
  ): string {
    if (isBlank(amount)) return '—'
    const decimals = options.decimals ?? settings.currencyDecimals
    const currency = options.currency ?? settings.currencyCode
    const formatted = new Intl.NumberFormat(numberLocale, {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      signDisplay: options.signed ? 'exceptZero' : 'auto',
    }).format(exact(amount))
    // Intl puts a non-breaking space after the code; keep it (no line breaks).
    return formatted
  }

  function number(value: Numeric, options: { decimals?: number; maxDecimals?: number } = {}) {
    if (isBlank(value)) return '—'
    return new Intl.NumberFormat(numberLocale, {
      minimumFractionDigits: options.decimals ?? 0,
      maximumFractionDigits: options.maxDecimals ?? options.decimals ?? 2,
    }).format(exact(value))
  }

  function percent(value: Numeric, decimals = 0) {
    if (isBlank(value)) return '—'
    return new Intl.NumberFormat(numberLocale, {
      style: 'percent',
      maximumFractionDigits: decimals,
    }).format(Number(value) / 100)
  }

  function parts(value: string | Date) {
    // A calendar date ("2026-03-04", e.g. an expense date) has no time of day:
    // format it as-is, never converted into another timezone.
    const calendarDate = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    const instant = calendarDate ? new Date(`${value}T00:00:00Z`) : new Date(value)
    const zone = calendarDate ? 'UTC' : timeZone
    const get = (opts: Intl.DateTimeFormatOptions) =>
      Object.fromEntries(
        new Intl.DateTimeFormat(textLocale, { timeZone: zone, ...opts })
          .formatToParts(instant)
          .map((p) => [p.type, p.value]),
      )
    return { date: instant, get }
  }

  function date(value: string | Date | null | undefined): string {
    if (!value) return '—'
    const { date: instant, get } = parts(value)
    if (Number.isNaN(instant.getTime())) return '—'
    const p = get({ year: 'numeric', month: '2-digit', day: '2-digit' })
    switch (settings.dateFormat) {
      case 'DD/MM/YYYY':
        return `${p.day}/${p.month}/${p.year}`
      case 'MM/DD/YYYY':
        return `${p.month}/${p.day}/${p.year}`
      case 'DD MMM YYYY': {
        const m = get({ month: 'short' }).month
        return `${p.day} ${m} ${p.year}`
      }
      default:
        return `${p.year}-${p.month}-${p.day}`
    }
  }

  function time(value: string | Date | null | undefined): string {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat(textLocale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(d)
  }

  function dateTime(value: string | Date | null | undefined): string {
    if (!value) return '—'
    return `${date(value)} ${time(value)}`
  }

  /** Today's calendar date in the business timezone, as YYYY-MM-DD (for API filters). */
  function today(): string {
    const p = parts(new Date()).get({ year: 'numeric', month: '2-digit', day: '2-digit' })
    return `${p.year}-${p.month}-${p.day}`
  }

  return { money, number, percent, date, time, dateTime, today, timeZone, settings }
}

export type Formatters = ReturnType<typeof createFormatters>
