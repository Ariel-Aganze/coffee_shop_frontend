import { useCallback, useSyncExternalStore } from 'react'

/** Tailwind's `md` breakpoint: tables from here up, card lists below. */
export const MD_UP = '(min-width: 48rem)'

/**
 * Whether a media query matches, updating on resize/rotation. Lets a page
 * render ONE layout (table or cards) instead of both with one hidden by CSS,
 * which would build every row twice.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
