import { Check, Circle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

import { MIN_PASSWORD_LENGTH, type PasswordRuleResult } from './passwordRules'

/** Checklist under a new-password field; ticks update as the user types. */
export function PasswordRequirements({
  results,
  id,
}: {
  results: PasswordRuleResult[]
  id?: string
}) {
  const { t } = useTranslation()
  return (
    <ul id={id} className="flex flex-col gap-1.5 text-sm" aria-label={t('password.requirements')}>
      {results.map((rule) => (
        <li
          key={rule.key}
          className={cn('flex items-center gap-2', rule.met ? 'text-success' : 'text-ink-muted')}
        >
          {rule.met ? (
            <Check className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <Circle className="size-4 shrink-0" aria-hidden="true" />
          )}
          <span>
            {t(`password.rules.${rule.key}`, { min: MIN_PASSWORD_LENGTH })}
            <span className="sr-only">
              {' '}
              ({rule.met ? t('password.met') : t('password.notMet')})
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
