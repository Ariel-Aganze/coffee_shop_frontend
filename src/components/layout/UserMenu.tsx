import { ChevronDown, KeyRound, LogOut, UserRound } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Avatar } from '@/components/ui/Avatar'
import { useAuth, useCurrentUser } from '@/features/auth/useAuth'
import { cn } from '@/lib/cn'
import { displayName } from '@/lib/names'

/** Avatar button opening a small account panel (disclosure pattern). */
export function UserMenu() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const user = useCurrentUser()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const name = displayName(user)

  // Close on outside click and on Escape (returning focus to the button).
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const item =
    'text-ink hover:bg-surface-muted flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm'

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('header.userMenu')}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 rounded-xl p-1 text-left transition-colors hover:bg-surface-muted md:pr-2"
      >
        <Avatar name={name} />
        <span className="hidden min-w-0 md:block">
          <span className="block max-w-40 truncate text-sm font-semibold text-ink">{name}</span>
          <span className="block max-w-40 truncate text-xs text-ink-muted">
            {t(`roles.${user.role}`)}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'hidden size-4 text-ink-muted transition-transform md:block',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 z-40 mt-2 w-64 rounded-card border border-border bg-surface p-2 shadow-pop"
        >
          <div className="mb-2 border-b border-border px-3 pt-2 pb-3">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="truncate text-xs text-ink-muted">{user.email || user.username}</p>
          </div>
          <ul>
            <li>
              <Link to="/profile" className={item} onClick={() => setOpen(false)}>
                <UserRound className="size-4 text-ink-muted" aria-hidden="true" />
                {t('header.profile')}
              </Link>
            </li>
            <li>
              <Link to="/profile/password" className={item} onClick={() => setOpen(false)}>
                <KeyRound className="size-4 text-ink-muted" aria-hidden="true" />
                {t('header.changePassword')}
              </Link>
            </li>
            <li>
              <button
                type="button"
                className={cn(item, 'text-danger')}
                onClick={() => void logout()}
              >
                <LogOut className="size-4" aria-hidden="true" />
                {t('header.signOut')}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
