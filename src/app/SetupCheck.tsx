/**
 * TEMPORARY screen for step 1 (project setup): proves the toolchain, design
 * tokens, brand assets and the API connection work. Replaced by the router
 * and app shell in step 2.
 */
import { useEffect, useState, type ReactNode } from 'react'

import { Logo } from '@/components/brand/Logo'
import { Loader } from '@/components/feedback/Loader'
import { env } from '@/config/env'
import { cn } from '@/lib/cn'

type ApiState = 'checking' | 'online' | 'offline'

function useApiHealth(): ApiState {
  const [state, setState] = useState<ApiState>('checking')
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${env.VITE_API_BASE_URL}/health/`, { signal: controller.signal })
      .then(async (res) => {
        const body: unknown = await res.json().catch(() => null)
        const ok = res.ok && (body as { status?: string } | null)?.status === 'ok'
        setState(ok ? 'online' : 'offline')
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== 'AbortError') setState('offline')
      })
    return () => controller.abort()
  }, [])
  return state
}

const SWATCHES = [
  { name: 'primary', className: 'bg-primary' },
  { name: 'primary-soft', className: 'bg-primary-soft' },
  { name: 'accent', className: 'bg-accent' },
  { name: 'canvas', className: 'bg-canvas' },
  { name: 'surface', className: 'bg-surface' },
  { name: 'peach', className: 'bg-peach' },
  { name: 'success', className: 'bg-success' },
  { name: 'warning', className: 'bg-warning' },
  { name: 'danger', className: 'bg-danger' },
  { name: 'info', className: 'bg-info' },
]

const STATUS = {
  checking: { label: 'Checking…', dot: 'bg-ink-subtle', badge: 'bg-surface-muted text-ink-muted' },
  online: { label: 'Connected', dot: 'bg-success', badge: 'bg-success-soft text-success' },
  offline: { label: 'Not reachable', dot: 'bg-danger', badge: 'bg-danger-soft text-danger' },
} as const

function Card({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-card border border-border bg-surface p-5 shadow-card sm:p-6',
        className,
      )}
    >
      <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}

export function SetupCheck() {
  const api = useApiHealth()
  const status = STATUS[api]

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <Logo className="h-12 sm:h-14" />
        </div>
        <div className="sm:text-right">
          <p className="text-sm text-ink-muted">Project setup</p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Foundations are ready
          </h1>
        </div>
      </header>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Card title="Backend API">
          <div className="flex items-center justify-between gap-3">
            <code className="truncate text-sm text-ink-muted">{env.VITE_API_BASE_URL}/health/</code>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-sm font-medium',
                status.badge,
              )}
            >
              <span className={cn('size-2 rounded-full', status.dot)} aria-hidden="true" />
              {status.label}
            </span>
          </div>
          {api === 'offline' && (
            <p className="mt-3 text-sm text-ink-muted">
              Start Django with{' '}
              <code className="text-ink">venv/bin/python manage.py runserver</code>.
            </p>
          )}
        </Card>

        <Card title="Loader">
          <div className="flex justify-center">
            <Loader label="Brewing your data…" />
          </div>
        </Card>

        <Card title="Typography">
          <p className="text-3xl font-semibold tracking-tight text-ink">Dashboard</p>
          <p className="mt-1 text-base text-ink">Body text in Outfit.</p>
          <p className="mt-1 text-sm text-ink-muted">Secondary text for labels and hints.</p>
        </Card>

        <Card title="Colour tokens" className="lg:col-span-3">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {SWATCHES.map((swatch) => (
              <li key={swatch.name} className="flex items-center gap-3">
                <span
                  className={cn(
                    'size-10 shrink-0 rounded-xl border border-border',
                    swatch.className,
                  )}
                  aria-hidden="true"
                />
                <span className="truncate text-sm text-ink-muted">{swatch.name}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  )
}
