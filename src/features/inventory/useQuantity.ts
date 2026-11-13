import { useTranslation } from 'react-i18next'

import { useFormat } from '@/features/business/useBusiness'

import { asUnit, quantityDecimals } from './api'

/** "12 pcs", "2.5 kg": a stock quantity with its unit, in the business number format. */
export function useQuantity() {
  const { t } = useTranslation()
  const format = useFormat()
  return (value: string | number, unit: string) => {
    const u = asUnit(unit)
    const n = format.number(value, { maxDecimals: quantityDecimals(u) })
    return t(`units.short.${u}`, { count: Number(value), n })
  }
}

/** Validates a typed quantity for a unit: whole numbers, or up to 3 decimals for kg/l. */
export function parseQuantity(raw: string, unit: string): string | null {
  const v = raw.trim().replace(',', '.')
  const decimals = quantityDecimals(asUnit(unit))
  const pattern = decimals ? new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`) : /^\d+$/
  return pattern.test(v) ? v : null
}
