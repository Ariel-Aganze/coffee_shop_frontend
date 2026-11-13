/**
 * Exact money arithmetic in minor units (cents, or whole francs for RWF) as
 * BigInt. Amounts come from the API and from inputs as decimal strings; they
 * are converted here, added/multiplied exactly, and turned back into decimal
 * strings for display or for the API. Nothing passes through a float
 * (CUR-024). Rounding is half-up, matching the backend.
 */

/** "2200.5000" → 220050n (2 decimals). Throws on malformed input. */
export function toMinor(value: string, decimals: number): bigint {
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(value.trim())
  if (!m) throw new Error(`Not a decimal amount: "${value}"`)
  const [, sign, whole, frac = ''] = m
  const kept = frac.slice(0, decimals).padEnd(decimals, '0')
  let minor = BigInt(whole! + kept)
  // Half-up on the first dropped digit.
  if (frac.length > decimals && Number(frac[decimals]) >= 5) minor += 1n
  return sign ? -minor : minor
}

/** 220050n → "2200.50" (2 decimals). */
export function fromMinor(minor: bigint, decimals: number): string {
  const negative = minor < 0n
  const digits = (negative ? -minor : minor).toString().padStart(decimals + 1, '0')
  const whole = decimals ? digits.slice(0, -decimals) : digits
  const frac = decimals ? `.${digits.slice(-decimals)}` : ''
  return `${negative ? '-' : ''}${whole}${frac}`
}

/** Unit price × whole quantity, exactly. */
export const times = (minor: bigint, quantity: number): bigint => minor * BigInt(quantity)

/** Share of `minor` for a percentage given as a decimal string ("10.00"), rounded half-up. */
export function percentOf(minor: bigint, percent: string): bigint {
  const basisPoints = toMinor(percent, 2) // 10.00% → 1000
  const scaled = minor * basisPoints
  const quotient = scaled / 10000n
  return scaled % 10000n >= 5000n ? quotient + 1n : quotient
}

export const sum = (values: readonly bigint[]): bigint => values.reduce((a, b) => a + b, 0n)
export const min = (a: bigint, b: bigint): bigint => (a < b ? a : b)
export const max = (a: bigint, b: bigint): bigint => (a > b ? a : b)
