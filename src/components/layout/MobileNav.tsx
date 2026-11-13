import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'

import { BranchPicker } from './BranchPicker'
import { SidebarNav } from './SidebarNav'

interface MobileNavProps {
  open: boolean
  onClose: () => void
}

/**
 * Slide-in navigation for phones and tablets. Built on the native <dialog>
 * (modal): focus is trapped inside, Escape closes it, and the page behind is
 * inert to screen readers.
 */
export function MobileNav({ open, onClose }: MobileNavProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Close when the route changes (link chosen, or the browser back button).
  const onCloseRef = useRef(onClose)
  const lastPath = useRef(pathname)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    onCloseRef.current()
  }, [pathname])

  return (
    // Backdrop click is a mouse convenience; keyboard users close the drawer
    // with Escape (native <dialog>) or the Close button.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-label={t('nav.label')}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose() // backdrop click
      }}
      className="m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none bg-surface p-0 shadow-pop backdrop:bg-espresso-950/40 lg:hidden"
    >
      <div className="relative h-full">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('nav.closeMenu')}
          className="absolute top-4 right-3 z-10 grid size-11 place-items-center rounded-xl text-ink-muted hover:bg-surface-muted"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        {/* Contents exist only while open: no duplicate navigation in the page. */}
        {open && (
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <SidebarNav onNavigate={onClose} />
            </div>
            <div className="border-t border-border px-4 py-3 sm:hidden">
              <BranchPicker />
            </div>
          </div>
        )}
      </div>
    </dialog>
  )
}
