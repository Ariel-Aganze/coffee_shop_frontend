/**
 * Date-range presets for the dashboard (DASH-011), worked out from "today at
 * the shop" (an ISO date string) so they never depend on the browser's clock
 * zone. Weeks start on Monday.
 */
export type Preset = 'today' | 'week' | 'month' | 'last30' | 'custom'

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`)
const toIso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (iso: string, days: number) => {
  const d = toDate(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return toIso(d)
}

export function presetRange(preset: Exclude<Preset, 'custom'>, today: string) {
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'week': {
      const weekday = (toDate(today).getUTCDay() + 6) % 7 // Monday = 0
      return { from: addDays(today, -weekday), to: today }
    }
    case 'month':
      return { from: `${today.slice(0, 8)}01`, to: today }
    case 'last30':
      return { from: addDays(today, -29), to: today }
  }
}

/** Which preset (if any) a from/to pair corresponds to. */
export function matchPreset(from: string, to: string, today: string): Preset {
  for (const p of ['today', 'week', 'month', 'last30'] as const) {
    const r = presetRange(p, today)
    if (r.from === from && r.to === to) return p
  }
  return 'custom'
}
