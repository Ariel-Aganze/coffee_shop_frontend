import loaderUrl from '@/assets/brand/loader.webp'
import loaderStaticUrl from '@/assets/brand/loader-static.webp'
import { cn } from '@/lib/cn'

const SIZES = {
  sm: 'size-12',
  md: 'size-20',
  lg: 'size-28',
} as const

interface LoaderProps {
  /** Visible text under the animation; also announced to screen readers. */
  label?: string
  size?: keyof typeof SIZES
  className?: string
}

/**
 * Branded loading indicator (the coffee-cup animation). Shows a still frame
 * when the user has asked their OS to reduce motion.
 *
 * Uses `role="status"` rather than `<output>`: it's the established pattern
 * for loading announcements and is announced reliably by screen readers
 * (including VoiceOver on iPad), which `<output>` is not.
 */
export function Loader({ label = 'Loading…', size = 'md', className }: LoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center gap-3 text-center', className)}
    >
      <div className={cn('overflow-hidden rounded-full bg-surface p-1 shadow-card', SIZES[size])}>
        <picture>
          <source srcSet={loaderStaticUrl} media="(prefers-reduced-motion: reduce)" />
          <img
            src={loaderUrl}
            alt=""
            aria-hidden="true"
            width={160}
            height={160}
            className="size-full rounded-full object-cover"
          />
        </picture>
      </div>
      <span className="text-sm font-medium text-ink-muted">{label}</span>
    </div>
  )
}

/** Full-screen loader for app start-up and route transitions. */
export function PageLoader({ label }: Pick<LoaderProps, 'label'>) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas p-6">
      <Loader size="lg" label={label} />
    </div>
  )
}
