/**
 * The ?next= target after sign-in — only same-app paths, never another site
 * (prevents open redirects such as ?next=https://evil.example or //evil.example).
 */
export function safeNextPath(search: string): string | null {
  const next = new URLSearchParams(search).get('next')
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null
  if (next.startsWith('/login')) return null
  return next
}
