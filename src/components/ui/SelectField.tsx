import { ChevronDown } from 'lucide-react'
import { useId, type ComponentProps, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface SelectFieldProps extends Omit<ComponentProps<'select'>, 'id'> {
  label: ReactNode
  hint?: ReactNode
  error?: string | undefined
}

/** Labelled native <select>: accessible everywhere and uses the phone's own picker. */
export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...props
}: SelectFieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-11 w-full appearance-none rounded-control border border-border bg-surface pr-10 pl-3.5 text-base text-ink sm:text-sm',
            'focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none',
            'aria-invalid:border-danger',
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-sm text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
