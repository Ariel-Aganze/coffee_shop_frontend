import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

/**
 * Plain semantic table styled to the design. Pages show it from `md` up and a
 * card list on phones (tables don't fit 360 px without sideways scrolling).
 */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  // Own scroll container: if a table is ever wider than its card, only the
  // table scrolls — never the whole page.
  return (
    // `relative`: absolutely positioned children (e.g. sr-only labels) stay inside.
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-left text-sm', className)} {...props} />
    </div>
  )
}

export function Th({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-border bg-surface-muted px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase first:pl-6 last:pr-6',
        className,
      )}
      {...props}
    />
  )
}

export function Td({ className, ...props }: ComponentProps<'td'>) {
  return (
    <td
      className={cn(
        'border-b border-border px-4 py-3.5 align-middle text-ink first:pl-6 last:pr-6',
        className,
      )}
      {...props}
    />
  )
}
