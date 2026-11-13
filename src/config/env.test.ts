import { describe, expect, it } from 'vitest'

import { parseEnv } from './env'

const base = { MODE: 'test', DEV: false, PROD: false }

describe('parseEnv', () => {
  it('accepts a relative API path and strips trailing slashes', () => {
    const env = parseEnv({ ...base, VITE_API_BASE_URL: '/api/' })
    expect(env.VITE_API_BASE_URL).toBe('/api')
    expect(env.VITE_APP_NAME).toBe('Caffio')
  })

  it('accepts an absolute http(s) URL', () => {
    const env = parseEnv({ ...base, VITE_API_BASE_URL: 'https://api.example.com/api' })
    expect(env.VITE_API_BASE_URL).toBe('https://api.example.com/api')
  })

  it('rejects a malformed API URL with a helpful message', () => {
    expect(() => parseEnv({ ...base, VITE_API_BASE_URL: 'api.example.com' })).toThrow(
      /VITE_API_BASE_URL: must be a path like \/api/,
    )
  })
})
