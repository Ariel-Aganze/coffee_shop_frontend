/** Page numbers to show: first, last, current ±1, with gaps as null. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const visible = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages))
  const sorted = [...visible].toSorted((a, b) => a - b)
  const result: (number | null)[] = []
  sorted.forEach((p, i) => {
    const previous = sorted[i - 1]
    if (previous !== undefined && p - previous > 1) result.push(null)
    result.push(p)
  })
  return result
}
