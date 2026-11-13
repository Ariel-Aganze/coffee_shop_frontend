import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, unwrap } from './client'
import { ApiError } from './errors'
import { onSessionExpired } from './session'
import { tokens } from './tokens'

type Handler = (request: Request) => Response | Promise<Response>

/** Route fetch calls by URL path; records every request. */
function mockServer(handlers: Record<string, Handler>) {
  const calls: Request[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init)
    calls.push(request.clone())
    const path = new URL(request.url, 'http://localhost').pathname
    const handler = handlers[path]
    if (!handler) throw new Error(`Unexpected request to ${path}`)
    return handler(request)
  })
  return calls
}

const json = (body: unknown, status = 200) => Response.json(body, { status })

beforeEach(() => {
  localStorage.clear()
  tokens.clear()
})
afterEach(() => {
  tokens.clear()
})

describe('api client', () => {
  it('sends the access token on protected endpoints only', async () => {
    tokens.set('access-1', 'refresh-1')
    const calls = mockServer({
      '/api/auth/me/': () => json({ id: 1 }),
      '/api/auth/password-reset/': () => json({ detail: 'If the email exists…' }),
    })
    await unwrap(api.GET('/api/auth/me/'))
    await unwrap(api.POST('/api/auth/password-reset/', { body: { email: 'a@b.co' } }))
    expect(calls[0]?.headers.get('Authorization')).toBe('Bearer access-1')
    expect(calls[1]?.headers.get('Authorization')).toBeNull()
  })

  it('renews an expired access token once and retries the request', async () => {
    tokens.set('expired', 'refresh-1')
    const calls = mockServer({
      '/api/auth/me/': (req) =>
        req.headers.get('Authorization') === 'Bearer fresh'
          ? json({ id: 1, username: 'owner' })
          : json({ detail: 'Token expired' }, 401),
      '/api/auth/token/refresh/': async (req) => {
        expect(await req.json()).toEqual({ refresh: 'refresh-1' })
        return json({ access: 'fresh', refresh: 'refresh-2' })
      },
    })
    const me = await unwrap(api.GET('/api/auth/me/'))
    expect(me).toMatchObject({ username: 'owner' })
    expect(tokens.getAccess()).toBe('fresh')
    expect(tokens.getRefresh()).toBe('refresh-2') // rotated token stored
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual([
      '/api/auth/me/',
      '/api/auth/token/refresh/',
      '/api/auth/me/',
    ])
  })

  it('retries request bodies intact after renewing the token', async () => {
    tokens.set('expired', 'refresh-1')
    const bodies: unknown[] = []
    mockServer({
      '/api/sales/1/cancel/': async (req) => {
        bodies.push(await req.json())
        return req.headers.get('Authorization') === 'Bearer fresh' ? json({ id: 1 }) : json({}, 401)
      },
      '/api/auth/token/refresh/': () => json({ access: 'fresh', refresh: 'r2' }),
    })
    await unwrap(
      api.POST('/api/sales/{id}/cancel/', {
        params: { path: { id: 1 } },
        body: { reason: 'Wrong order' },
      }),
    )
    expect(bodies).toEqual([{ reason: 'Wrong order' }, { reason: 'Wrong order' }])
  })

  it('shares one refresh between concurrent 401s (rotation-safe)', async () => {
    tokens.set('expired', 'refresh-1')
    let refreshes = 0
    mockServer({
      '/api/auth/me/': (req) =>
        req.headers.get('Authorization') === 'Bearer fresh' ? json({ id: 1 }) : json({}, 401),
      '/api/auth/token/refresh/': async () => {
        refreshes += 1
        await new Promise((r) => setTimeout(r, 10))
        return json({ access: 'fresh', refresh: 'refresh-2' })
      },
    })
    await Promise.all([1, 2, 3].map(() => unwrap(api.GET('/api/auth/me/'))))
    expect(refreshes).toBe(1)
  })

  it('signs out when the refresh token is rejected', async () => {
    tokens.set('expired', 'stolen-or-old')
    const expired = vi.fn<() => void>()
    const unsubscribe = onSessionExpired(expired)
    mockServer({
      '/api/auth/me/': () => json({ detail: 'Token expired' }, 401),
      '/api/auth/token/refresh/': () => json({ detail: 'Token is blacklisted' }, 401),
    })
    await expect(unwrap(api.GET('/api/auth/me/'))).rejects.toMatchObject({ status: 401 })
    expect(expired).toHaveBeenCalledOnce()
    expect(tokens.getRefresh()).toBeNull()
    unsubscribe()
  })

  it('turns network failures into ApiError with status 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await unwrap(api.GET('/api/auth/me/')).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).isNetworkError).toBe(true)
  })

  it('exposes field errors from validation responses', async () => {
    mockServer({
      '/api/auth/login/': () => json({ username: ['This field is required.'] }, 400),
    })
    const error = (await unwrap(
      api.POST('/api/auth/login/', { body: { username: '', password: 'x' } }),
    ).catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(400)
    expect(error.fieldErrors.username).toEqual(['This field is required.'])
  })
})
