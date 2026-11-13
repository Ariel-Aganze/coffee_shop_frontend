/**
 * Convert between `<input type="datetime-local">` values ("2026-11-20T08:00")
 * and instants, in the BUSINESS timezone rather than the browser's. A manager
 * travelling abroad who schedules "8:00" means 8:00 at the shop.
 */

const PARTS_FORMAT = new Map<string, Intl.DateTimeFormat>()

function partsFormat(timeZone: string) {
  let f = PARTS_FORMAT.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    PARTS_FORMAT.set(timeZone, f)
  }
  return f
}

/** Wall-clock fields of `instant` in `timeZone`, as if they were UTC (ms). */
function wallClockAsUtc(instant: number, timeZone: string): number {
  const p = Object.fromEntries(
    partsFormat(timeZone)
      .formatToParts(instant)
      .map((x) => [x.type, Number(x.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "YYYY-MM-DDTHH:mm" as shown at the shop → ISO instant, or null if malformed. */
export function zonedInputToIso(value: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number]
  const naive = Date.UTC(y, mo - 1, d, h, mi)
  // Two passes settle the offset, including across a DST change.
  let guess = naive - (wallClockAsUtc(naive, timeZone) - naive)
  guess = naive - (wallClockAsUtc(guess, timeZone) - guess)
  return new Date(guess).toISOString()
}

/** Instant → "YYYY-MM-DDTHH:mm" at the shop (for input values and `min`). */
export function isoToZonedInput(instant: string | number | Date, timeZone: string): string {
  const d = new Date(wallClockAsUtc(new Date(instant).getTime(), timeZone))
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  )
}
