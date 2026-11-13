import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

const TONES = {
  danger: { className: 'bg-danger-soft text-danger', Icon: CircleAlert },
  success: { className: 'bg-success-soft text-success', Icon: CircleCheck },
  info: { className: 'bg-info-soft text-info', Icon: Info },
} as const

interface AlertProps {
  tone: keyof typeof TONES
  children: ReactNode
  className?: string
}

/**
 * Inline message banner. Errors use role="alert" (announced immediately);
 * other tones use role="status" (announced politely).
 */
export function Alert({ tone, children, className }: AlertProps) {
  const { className: toneClass, Icon } = TONES[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm', toneClass, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
