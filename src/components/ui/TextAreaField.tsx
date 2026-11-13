import { useId, type ComponentProps, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface TextAreaFieldProps extends Omit<ComponentProps<'textarea'>, 'id'> {
  label: ReactNode
  hint?: ReactNode
  error?: string | undefined
}

export function TextAreaField({
  label,
  hint,
  error,
  className,
  rows = 3,
  ...props
}: TextAreaFieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'w-full rounded-control border border-border bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-ink-subtle sm:text-sm',
          'focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none',
          'aria-invalid:border-danger',
        )}
        {...props}
      />
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
