import { LoaderCircle } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/cn'

const VARIANTS = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm',
  secondary: 'bg-surface text-ink border border-border hover:bg-surface-muted',
  soft: 'bg-primary-soft text-primary hover:bg-espresso-200',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger/90 shadow-sm',
  'danger-soft': 'bg-danger-soft text-danger hover:bg-danger-soft/70',
} as const

const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2', // 44px: comfortable touch target
  lg: 'h-12 px-5 text-base gap-2',
  icon: 'size-11 justify-center',
} as const

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
  /** Shows a spinner, disables the button and keeps its width. */
  loading?: boolean
  leadingIcon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leadingIcon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-control font-medium whitespace-nowrap transition-colors',
        'disabled:pointer-events-none disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : leadingIcon}
      {children}
    </button>
  )
}
