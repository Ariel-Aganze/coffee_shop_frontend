/** Display name of a person: "First Last", or the username when no name is set. */
export function displayName(user: { first_name: string; last_name: string; username: string }) {
  return `${user.first_name} ${user.last_name}`.trim() || user.username
}

/** Two-letter initials for avatars: "Aline Uwase" → "AU", "owner" → "OW". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : (words[0]?.[1] ?? '')
  return (first + last).toUpperCase()
}
