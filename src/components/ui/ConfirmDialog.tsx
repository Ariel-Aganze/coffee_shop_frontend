import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert } from './Alert'
import { Button } from './Button'
import { Dialog } from './Dialog'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: ReactNode
  children: ReactNode
  confirmLabel: string
  tone?: 'danger' | 'primary'
  pending?: boolean
  /** Error from the last attempt, shown inside the dialog. */
  error?: string | null
}

/** "Are you sure?" with the consequences spelled out, for actions that matter. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  tone = 'danger',
  pending = false,
  error,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      dismissible={!pending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {t('changePassword.cancel')}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-ink">
        {children}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  )
}
