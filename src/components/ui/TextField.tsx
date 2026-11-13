import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ComponentProps, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: ReactNode
  /** Shown under the input; replaced by `error` when there is one. */
  hint?: ReactNode
  error?: string | undefined
  /** Element inside the input on the right (e.g. a show-password button). */
  trailing?: ReactNode
}

const inputClass =
  'rounded-control border-border bg-surface text-ink placeholder:text-ink-subtle h-11 w-full border px-3.5 text-base transition-colors sm:text-sm ' +
  'focus:border-primary focus:ring-primary/15 focus:ring-4 focus:outline-none ' +
  'disabled:bg-surface-muted disabled:text-ink-muted ' +
  'aria-invalid:border-danger aria-invalid:focus:ring-danger/15'

/** Labelled input with hint and error message wired up for screen readers. */
export function TextField({
  label,
  hint,
  error,
  trailing,
  className,
  'aria-describedby': extraDescribedBy,
  ...props
}: TextFieldProps) {
  const id = useId()
  // Keep the field's own error/hint link and any extra description (e.g. a
  // password checklist) — a caller's aria-describedby must not replace it.
  const describedBy =
    [error ? `${id}-error` : hint ? `${id}-hint` : undefined, extraDescribedBy]
      .filter(Boolean)
      .join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(inputClass, trailing && 'pr-12')}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
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

interface PasswordFieldProps extends Omit<TextFieldProps, 'type' | 'trailing'> {
  showLabel: string
  hideLabel: string
}

export function PasswordField({ showLabel, hideLabel, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="grid size-10 place-items-center rounded-lg text-ink-muted hover:text-ink"
        >
          {visible ? (
            <EyeOff className="size-5" aria-hidden="true" />
          ) : (
            <Eye className="size-5" aria-hidden="true" />
          )}
        </button>
      }
    />
  )
}
