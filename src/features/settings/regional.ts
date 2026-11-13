/**
 * Regional preference options (SRS 5.14.1). The allowed values come from the
 * API schema (LanguageEnum, DateFormatEnum, NumberFormatEnum), so the UI and
 * the backend can't drift apart.
 */
import type { Schema } from '@/lib/api/types'
import { createFormatters, DEFAULT_FORMAT_SETTINGS } from '@/lib/format'

export type Language = Schema<'LanguageEnum'>
export type DateFormat = Schema<'DateFormatEnum'>
export type NumberFormat = Schema<'NumberFormatEnum'>

export const LANGUAGES: { value: Language; label: string; available: boolean }[] = [
  { value: 'en', label: 'English', available: true },
  { value: 'fr', label: 'Français', available: false }, // translation not shipped yet
]

export const DATE_FORMATS: DateFormat[] = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD MMM YYYY']
export const NUMBER_FORMATS: NumberFormat[] = ['1,234.56', '1.234,56', '1 234,56', "1'234.56"]

const SAMPLE_DATE = '2026-03-04'

/** "04/03/2026" — how a date looks in each format. */
export function datePreview(dateFormat: DateFormat): string {
  return createFormatters({ ...DEFAULT_FORMAT_SETTINGS, dateFormat }).date(SAMPLE_DATE)
}

/** "1 234 567,50" — how a number looks in each format. */
export function numberPreview(numberFormat: NumberFormat): string {
  return createFormatters({ ...DEFAULT_FORMAT_SETTINGS, numberFormat }).number('1234567.5', {
    decimals: 2,
  })
}

/** IANA timezones grouped by region, Africa first (the SRS's primary market). */
export function timezoneGroups(): { region: string; zones: string[] }[] {
  const all: string[] =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC']
  const groups = new Map<string, string[]>()
  for (const zone of all) {
    const region = zone.includes('/') ? zone.split('/')[0]! : 'Other'
    groups.set(region, [...(groups.get(region) ?? []), zone])
  }
  const order = [
    'Africa',
    'Europe',
    'America',
    'Asia',
    'Atlantic',
    'Indian',
    'Australia',
    'Pacific',
  ]
  return [...groups.entries()]
    .toSorted(([a], [b]) => {
      const ia = order.indexOf(a)
      const ib = order.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b)
    })
    .map(([region, zones]) => ({ region, zones }))
}

/** The browser's timezone, as a sensible default during sign-up. */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** "Africa/Kigali" → "Kigali"; "America/Argentina/Buenos_Aires" → "Argentina / Buenos Aires". */
export function timezoneLabel(zone: string): string {
  return zone.split('/').slice(1).join(' / ').replaceAll('_', ' ') || zone
}
