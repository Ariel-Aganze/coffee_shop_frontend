/**
 * Minimal fake API for tests: routes fetch() calls by "METHOD /path" and
 * records them. Unhandled requests fail loudly so tests can't silently
 * depend on endpoints they didn't declare.
 */
import { vi } from 'vitest'

type Handler = (request: Request) => Response | Promise<Response>

export const json = (body: unknown, status = 200) => Response.json(body, { status })

export function mockApi(handlers: Record<string, Handler>) {
  const calls: { method: string; path: string; request: Request }[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init)
    const url = new URL(request.url)
    const key = `${request.method} ${url.pathname}`
    calls.push({ method: request.method, path: url.pathname, request: request.clone() })
    const handler = handlers[key]
    if (!handler) throw new Error(`mockApi: unexpected request ${key}`)
    return handler(request)
  })
  return calls
}

// ---------------------------------------------------------------- fixtures
export const fixtures = {
  business: {
    id: 1,
    name: 'Demo Coffee Co.',
    contact_email: '',
    contact_phone: '',
    address: '',
    logo: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
  settings: {
    id: 1,
    primary_currency: {
      id: 1,
      code: 'RWF',
      name: 'Rwandan Franc',
      symbol: 'FRw',
      decimal_places: 0,
      country_hint: 'Rwanda',
    },
    language: 'en',
    timezone: 'Africa/Kigali',
    date_format: 'YYYY-MM-DD',
    number_format: '1,234.56',
    cashier_max_discount_percent: '10.00',
    updated_at: '2026-10-01T00:00:00Z',
  },
  branches: [
    {
      id: 1,
      business: 1,
      name: 'Kigali Heights',
      address: '',
      phone: '',
      is_active: true,
      staff_count: 0,
      managers: [],
      created_at: '',
      updated_at: '',
    },
    {
      id: 2,
      business: 1,
      name: 'Nyarutarama',
      address: '',
      phone: '',
      is_active: true,
      staff_count: 0,
      managers: [],
      created_at: '',
      updated_at: '',
    },
  ],
  currencies: [
    {
      id: 1,
      code: 'RWF',
      name: 'Rwandan Franc',
      symbol: 'FRw',
      decimal_places: 0,
      country_hint: 'Rwanda',
    },
    {
      id: 2,
      code: 'KES',
      name: 'Kenyan Shilling',
      symbol: 'KSh',
      decimal_places: 2,
      country_hint: 'Kenya',
    },
    {
      id: 3,
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      decimal_places: 2,
      country_hint: 'United States',
    },
    {
      id: 4,
      code: 'XAF',
      name: 'Central African CFA Franc',
      symbol: 'FCFA',
      decimal_places: 0,
      country_hint: 'Central Africa (CEMAC)',
    },
  ],
  user(role: string, overrides: Record<string, unknown> = {}) {
    return {
      id: 7,
      username: `demo_${role}`,
      email: `${role}@demo.example`,
      first_name: 'Aline',
      last_name: 'Uwase',
      phone: '',
      role,
      is_active: true,
      branch_ids: role === 'owner' ? [] : [1],
      date_joined: '2026-10-01T00:00:00Z',
      last_login: null,
      ...overrides,
    }
  },
}

/** Handlers every signed-in screen needs (business context + header). */
export function shellHandlers(user: ReturnType<typeof fixtures.user>) {
  const visibleBranches =
    user.role === 'owner'
      ? fixtures.branches
      : fixtures.branches.filter((b) => (user.branch_ids as number[]).includes(b.id))
  return {
    'GET /api/auth/me/': () => json(user),
    'GET /api/businesses/me/': () => json(fixtures.business),
    'GET /api/settings/me/': () => json(fixtures.settings),
    'GET /api/branches/': () =>
      json({ count: visibleBranches.length, next: null, previous: null, results: visibleBranches }),
    'GET /api/notifications/unread-count/': () => json({ unread: 3 }),
  } satisfies Record<string, Handler>
}
