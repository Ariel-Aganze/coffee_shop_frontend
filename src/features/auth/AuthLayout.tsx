import { useEffect, useRef, type ReactNode } from 'react'

import { Logo } from '@/components/brand/Logo'

interface AuthLayoutProps {
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  /** Under the card (e.g. "Back to sign in"). */
  footer?: ReactNode
  /**
   * Move focus to the title when shown — for result screens ("Check your
   * email") that replace a form, so screen readers announce the new state.
   */
  focusTitle?: boolean
  /** Card width: 'md' for short forms, 'lg' for the registration wizard. */
  width?: 'md' | 'lg'
}

/** Centred brand card used by the signed-out screens (sign in, password reset). */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  focusTitle = false,
  width = 'md',
}: AuthLayoutProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (focusTitle) titleRef.current?.focus()
  }, [focusTitle])
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className={width === 'lg' ? 'w-full max-w-2xl' : 'w-full max-w-md'}>
        <div className="mb-8 flex justify-center">
          <Logo className="h-16 sm:h-20" />
        </div>
        <div className="rounded-card border border-border bg-surface p-6 shadow-card sm:p-8">
          <h1
            ref={titleRef}
            tabIndex={focusTitle ? -1 : undefined}
            className="text-2xl font-semibold tracking-tight text-ink outline-none"
          >
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
          {children}
        </div>
        {footer && <div className="mt-6 flex justify-center">{footer}</div>}
      </div>
    </main>
  )
}
