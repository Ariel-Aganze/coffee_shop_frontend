/**
 * JWT storage.
 *
 * - The short-lived ACCESS token lives only in memory: it never touches
 *   storage, so it can't be read back after the tab closes.
 * - The REFRESH token is kept in localStorage so a signed-in session survives
 *   reloads and new tabs. The backend rotates it on every use and blacklists
 *   the old one, so a copied token stops working once the real client
 *   refreshes; logout blacklists it immediately.
 *   (Moving it to an httpOnly cookie would also hide it from scripts; that
 *   needs backend cookie support and is noted as future hardening.)
 */
const REFRESH_KEY = 'caffio.refresh'

type Listener = () => void

let accessToken: string | null = null
const listeners = new Set<Listener>()

function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null // private mode / blocked storage: session lasts for this tab only
  }
}

let memoryRefresh: string | null = null

export const tokens = {
  getAccess(): string | null {
    return accessToken
  },

  getRefresh(): string | null {
    const storage = safeStorage()
    return storage ? storage.getItem(REFRESH_KEY) : memoryRefresh
  },

  set(access: string, refresh: string): void {
    accessToken = access
    const storage = safeStorage()
    if (storage) storage.setItem(REFRESH_KEY, refresh)
    else memoryRefresh = refresh
    listeners.forEach((fn) => fn())
  },

  clear(): void {
    accessToken = null
    memoryRefresh = null
    safeStorage()?.removeItem(REFRESH_KEY)
    listeners.forEach((fn) => fn())
  },

  /** Called whenever tokens change (set or cleared). Returns an unsubscribe. */
  subscribe(fn: Listener): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  /** Storage key, exposed so other tabs' sign-outs can be detected. */
  storageKey: REFRESH_KEY,
}
