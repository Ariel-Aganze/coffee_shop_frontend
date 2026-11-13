import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { useAuth, useCurrentUser } from '@/features/auth/useAuth'
import { cn } from '@/lib/cn'

import { navigationFor } from './navigation'

interface SidebarNavProps {
  /** Called after a link is chosen (closes the mobile drawer). */
  onNavigate?: () => void
}

/** Logo, role-filtered navigation and sign-out — shared by the desktop sidebar and mobile drawer. */
export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const user = useCurrentUser()
  const groups = navigationFor(user.role)

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 shrink-0 items-center px-6">
        <Logo className="h-11" />
      </div>

      <nav aria-label={t('nav.label')} className="flex-1 overflow-y-auto px-4 pb-4">
        {groups.map((group) => (
          <div key={group.section} className="mt-4 first:mt-2">
            {/* Section titles only help when there are several groups. */}
            {groups.length > 1 && (
              <p className="mb-1.5 px-3 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
                {t(`nav.sections.${group.section}`)}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => (
                <li key={item.key}>
                  <NavLink
                    to={item.path}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'relative flex h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] transition-colors',
                        isActive
                          ? 'bg-primary-soft font-semibold text-ink before:absolute before:inset-y-2 before:-left-1 before:w-1 before:rounded-full before:bg-primary'
                          : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                      )
                    }
                  >
                    <item.icon className="size-5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{t(`nav.${item.key}`)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 p-4">
        <button
          type="button"
          onClick={() => void logout()}
          className="flex h-11 w-full items-center gap-3 rounded-xl bg-danger-soft px-3 text-[0.9375rem] font-medium text-danger transition-colors hover:bg-danger-soft/70"
        >
          <LogOut className="size-5" aria-hidden="true" />
          {t('header.signOut')}
        </button>
      </div>
    </div>
  )
}
