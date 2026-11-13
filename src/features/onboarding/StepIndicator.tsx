import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

import { STEPS } from './schema'

/** Wizard progress: numbered steps on larger screens, "Step 2 of 5" + bar on phones. */
export function StepIndicator({ current, className }: { current: number; className?: string }) {
  const { t } = useTranslation()
  const total = STEPS.length
  const label = t(`onboarding.steps.${STEPS[current]!.key}.short`)

  return (
    <nav aria-label={t('onboarding.progress')} className={className}>
      {/* Phones */}
      <div className="sm:hidden">
        <p className="text-sm font-medium text-ink">
          {t('onboarding.stepOf', { step: current + 1, total })} · {label}
        </p>
        {/* Decorative: the text above already says which step this is. */}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary-soft" aria-hidden="true">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Tablets and up */}
      <ol className="hidden items-center gap-2 sm:flex">
        {STEPS.map((step, index) => {
          const done = index < current
          const active = index === current
          return (
            <li
              key={step.key}
              aria-current={active ? 'step' : undefined}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold',
                  done && 'bg-success text-white',
                  active && 'bg-primary text-primary-foreground',
                  !done && !active && 'bg-surface-muted text-ink-muted',
                )}
              >
                {done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
              </span>
              <span
                className={cn(
                  'truncate text-sm',
                  active ? 'font-semibold text-ink' : 'text-ink-muted',
                )}
              >
                {t(`onboarding.steps.${step.key}.short`)}
                {done && <span className="sr-only"> ({t('onboarding.done')})</span>}
              </span>
              {index < total - 1 && (
                <span className="hidden h-px flex-1 bg-border lg:block" aria-hidden="true" />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
