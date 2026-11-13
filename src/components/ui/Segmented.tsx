import { useId } from 'react'

import { cn } from '@/lib/cn'

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}

/** Small exclusive choice (e.g. Active / Inactive / All): a native radio group. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedProps<T>) {
  const name = useId()
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="sr-only">{label}</legend>
      <div className="inline-flex h-11 rounded-control border border-border bg-surface-muted p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-center rounded-[0.55rem] px-3 text-sm font-medium whitespace-nowrap transition-colors',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
              option.value === value
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
