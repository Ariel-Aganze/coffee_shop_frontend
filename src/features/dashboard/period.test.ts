import { describe, expect, it } from 'vitest'

import { matchPreset, presetRange } from './period'

describe('dashboard periods', () => {
  it('works out presets from the shop’s today', () => {
    const friday = '2026-11-13'
    expect(presetRange('today', friday)).toEqual({ from: friday, to: friday })
    expect(presetRange('week', friday)).toEqual({ from: '2026-11-09', to: friday })
    expect(presetRange('week', '2026-11-09')).toEqual({ from: '2026-11-09', to: '2026-11-09' })
    expect(presetRange('week', '2026-11-15')).toEqual({ from: '2026-11-09', to: '2026-11-15' }) // Sunday
    expect(presetRange('month', friday)).toEqual({ from: '2026-11-01', to: friday })
    expect(presetRange('last30', '2026-03-01')).toEqual({ from: '2026-01-31', to: '2026-03-01' })
  })

  it('recognises a preset from its dates', () => {
    expect(matchPreset('2026-11-01', '2026-11-13', '2026-11-13')).toBe('month')
    expect(matchPreset('2026-10-01', '2026-10-31', '2026-11-13')).toBe('custom')
  })
})
