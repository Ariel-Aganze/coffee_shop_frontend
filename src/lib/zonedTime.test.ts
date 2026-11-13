import { describe, expect, it } from 'vitest'

import { isoToZonedInput, zonedInputToIso } from './zonedTime'

describe('business-timezone datetime inputs', () => {
  it('reads the input as shop time, not browser time', () => {
    expect(zonedInputToIso('2026-11-20T08:00', 'Africa/Kigali')).toBe('2026-11-20T06:00:00.000Z')
    expect(zonedInputToIso('2026-11-20T08:00', 'UTC')).toBe('2026-11-20T08:00:00.000Z')
    expect(zonedInputToIso('2026-11-20T08:00', 'America/New_York')).toBe('2026-11-20T13:00:00.000Z')
  })

  it('handles daylight saving on both sides of the change', () => {
    expect(zonedInputToIso('2026-07-01T08:00', 'Europe/Paris')).toBe('2026-07-01T06:00:00.000Z')
    expect(zonedInputToIso('2026-12-01T08:00', 'Europe/Paris')).toBe('2026-12-01T07:00:00.000Z')
  })

  it('round-trips and rejects malformed values', () => {
    const iso = '2026-11-20T06:00:00.000Z'
    expect(isoToZonedInput(iso, 'Africa/Kigali')).toBe('2026-11-20T08:00')
    expect(zonedInputToIso(isoToZonedInput(iso, 'Asia/Kolkata'), 'Asia/Kolkata')).toBe(iso)
    expect(zonedInputToIso('20/11/2026 08:00', 'UTC')).toBeNull()
  })
})
