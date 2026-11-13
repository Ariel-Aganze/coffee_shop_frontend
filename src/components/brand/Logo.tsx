import logoUrl from '@/assets/brand/logo.webp'
import { env } from '@/config/env'
import { cn } from '@/lib/cn'

interface LogoProps {
  className?: string
}

/** The Caffio wordmark. Size it with a height class, e.g. `h-10`. */
export function Logo({ className }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt={env.VITE_APP_NAME}
      width={640}
      height={280}
      decoding="async"
      className={cn('h-10 w-auto select-none', className)}
      draggable={false}
    />
  )
}
