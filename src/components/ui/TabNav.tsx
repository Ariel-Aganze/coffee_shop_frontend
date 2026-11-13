import { NavLink } from 'react-router'

import { cn } from '@/lib/cn'

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium whitespace-nowrap transition-colors',
    isActive ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
  )

interface TabNavProps {
  label: string
  items: readonly { to: string; label: string; end?: boolean }[]
}

/** Links between sibling pages, styled as tabs (e.g. Products | Categories). */
export function TabNav({ label, items }: TabNavProps) {
  return (
    <nav aria-label={label} className="max-w-full overflow-x-auto">
      <div className="inline-flex gap-1 rounded-xl bg-surface-muted p-1">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={tab}>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
