import { z } from 'zod'

/**
 * Money typed into a form stays a decimal STRING all the way to the API, so
 * nothing passes through floating point (CUR-024). People may type a comma
 * as the decimal mark ("2500,50"); grouping separators are not accepted.
 */
export function normalizeAmount(raw: string): string {
  const v = raw.trim().replace(/\s/g, '')
  return v.includes(',') && !v.includes('.') ? v.replace(',', '.') : v
}

/** Zod rule for an amount with at most `decimals` decimal places. */
export function amountSchema(decimals: number, { required = true } = {}) {
  const pattern = decimals > 0 ? new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`) : /^\d+$/
  return z
    .string()
    .transform(normalizeAmount)
    .superRefine((v, ctx) => {
      if (v === '') {
        if (required) ctx.addIssue({ code: 'custom', message: 'products.amountRequired' })
        return
      }
      if (!pattern.test(v)) {
        ctx.addIssue({
          code: 'custom',
          message: decimals > 0 ? 'products.amountInvalid' : 'products.amountWhole',
        })
      }
    })
}

/** "2200.0000" → "2200", "2.5000" → "2.5": a tidy starting value for an input. */
export function toInputAmount(value: string | null | undefined): string {
  if (!value) return ''
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value
}

/**
 * Gross margin as a share of the selling price (0.62 = 62%), or null when it
 * can't be worked out. Only for display, so a float is fine here.
 */
export function marginRatio(price: string | null | undefined, cost: string | null | undefined) {
  const p = Number(price)
  const c = Number(cost)
  if (!price || cost === null || cost === undefined || cost === '' || !(p > 0)) return null
  if (Number.isNaN(c)) return null
  return (p - c) / p
}
