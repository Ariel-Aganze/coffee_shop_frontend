import { ChevronDown, Store } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { useBusiness } from '@/features/business/useBusiness'
import { cn } from '@/lib/cn'

/**
 * Which branch the screens show. A native <select>: accessible and uses the
 * phone's own picker on mobile. Hidden when there is nothing to choose.
 */
export function BranchPicker({ className }: { className?: string }) {
  const { t } = useTranslation()
  const id = useId()
  const { branches, branchId, setBranchId, canSelectAll } = useBusiness()

  const choices = branches.length + (canSelectAll ? 1 : 0)
  if (choices <= 1) {
    const only = branches[0]
    // The outer element takes the caller's sizing/visibility classes (which may
    // set `display`); the inner row keeps icon and name side by side.
    return only ? (
      <div className={className}>
        <span className="flex items-center justify-end gap-2 text-sm text-ink-muted">
          <Store className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{only.name}</span>
        </span>
      </div>
    ) : null
  }

  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {t('header.branch')}
      </label>
      <Store
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      <select
        id={id}
        value={branchId ?? 'all'}
        onChange={(e) => setBranchId(e.target.value === 'all' ? null : Number(e.target.value))}
        className="h-10 w-full appearance-none rounded-xl border border-border bg-surface pr-9 pl-9 text-sm font-medium text-ink hover:bg-surface-muted"
      >
        {canSelectAll && <option value="all">{t('header.allBranches')}</option>}
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
    </div>
  )
}
