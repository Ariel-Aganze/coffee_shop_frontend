/**
 * Typed API client.
 *
 *   const sale = await unwrap(api.GET('/api/sales/{id}/', { params: { path: { id } } }))
 *
 * Paths, parameters, request bodies and responses are all checked against the
 * generated OpenAPI types. Every request carries the access token; on a 401
 * the token is renewed once and the request retried transparently.
 */
import createClient, { type Middleware } from 'openapi-fetch'

import { apiOrigin } from '@/config/env'

import { ApiError } from './errors'
import type { paths } from './schema'
import { refreshAccessToken, SessionExpiredError } from './session'
import { tokens } from './tokens'

/** Endpoints that must never carry (or retry with) a user's token. */
const PUBLIC_PATHS = new Set([
  '/api/auth/login/',
  '/api/auth/token/refresh/',
  '/api/auth/password-reset/',
  '/api/auth/password-reset/confirm/',
  '/api/businesses/register/',
])

// Untouched copies of outgoing requests, so a 401 can be retried with a new token.
const pendingRetries = new Map<string, Request>()

const authMiddleware: Middleware = {
  onRequest({ request, schemaPath, id }) {
    if (PUBLIC_PATHS.has(schemaPath)) return request
    const access = tokens.getAccess()
    if (access) request.headers.set('Authorization', `Bearer ${access}`)
    pendingRetries.set(id, request.clone())
    return request
  },

  async onResponse({ response, schemaPath, id }) {
    const original = pendingRetries.get(id)
    pendingRetries.delete(id)
    if (response.status !== 401 || PUBLIC_PATHS.has(schemaPath) || !original) return response

    let access: string
    try {
      access = await refreshAccessToken()
    } catch (error) {
      if (error instanceof SessionExpiredError) return response // listeners handle sign-out
      throw error
    }
    const retry = new Request(original, { headers: new Headers(original.headers) })
    retry.headers.set('Authorization', `Bearer ${access}`)
    return fetch(retry)
  },

  onError({ id }) {
    pendingRetries.delete(id)
  },
}

export const api = createClient<paths>({
  baseUrl: apiOrigin,
  // Resolve fetch at call time so tests (and any polyfill) can replace it.
  fetch: (request) => globalThis.fetch(request),
})
api.use(authMiddleware)

type FetchResult<T> = { data?: T; error?: unknown; response: Response }

/**
 * Turn an openapi-fetch result into data or a thrown ApiError — the shape
 * TanStack Query expects. Network failures become ApiError with status 0.
 */
export async function unwrap<T>(request: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>
  try {
    result = await request
  } catch (error) {
    if (error instanceof ApiError) throw error
    // fetch() rejects only when the request couldn't be made (offline, DNS,
    // CORS…). Keep the original as `cause` so real bugs aren't disguised.
    if (import.meta.env.DEV) console.error('API request failed before a response:', error)
    throw new ApiError(0, null, { cause: error })
  }
  if (result.error !== undefined || !result.response.ok) {
    throw new ApiError(result.response.status, result.error)
  }
  return result.data as T
}
