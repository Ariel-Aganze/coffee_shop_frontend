/**
 * Access-token renewal.
 *
 * The backend rotates refresh tokens and rejects any token that was already
 * used, so two refreshes must never race with the same token:
 *   - within a tab, concurrent callers share one in-flight refresh;
 *   - across tabs, the Web Locks API makes tabs take turns, and each reads the
 *     newest token from storage once it holds the lock.
 */
import { apiUrl } from '@/config/env'

import { tokens } from './tokens'

export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please sign in again.')
    this.name = 'SessionExpiredError'
  }
}

type ExpiredListener = () => void
const expiredListeners = new Set<ExpiredListener>()

/** Notified when the session can't be renewed (the user must sign in again). */
export function onSessionExpired(fn: ExpiredListener): () => void {
  expiredListeners.add(fn)
  return () => expiredListeners.delete(fn)
}

const LOCK_NAME = 'caffio-token-refresh'
let inFlight: Promise<string> | null = null

async function requestNewTokens(): Promise<string> {
  const refresh = tokens.getRefresh()
  if (!refresh) throw new SessionExpiredError()

  let response: Response
  try {
    response = await fetch(apiUrl('/api/auth/token/refresh/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
  } catch {
    // Offline or server down: keep the session, let the caller report it.
    throw new TypeError('Network error while renewing the session')
  }

  if (!response.ok) {
    tokens.clear()
    expiredListeners.forEach((fn) => fn())
    throw new SessionExpiredError()
  }
  const body = (await response.json()) as { access: string; refresh?: string }
  tokens.set(body.access, body.refresh ?? refresh)
  return body.access
}

/** Get a fresh access token. Throws SessionExpiredError if the user must sign in. */
export function refreshAccessToken(): Promise<string> {
  if (!inFlight) {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
    const run = locks ? locks.request(LOCK_NAME, () => requestNewTokens()) : requestNewTokens()
    inFlight = run.finally(() => {
      inFlight = null
    })
  }
  return inFlight
}
