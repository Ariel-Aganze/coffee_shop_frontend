import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PasswordField } from '@/components/ui/TextField'
import { PasswordRequirements } from '@/features/auth/PasswordRequirements'
import { checkPassword, passwordIsAcceptable } from '@/features/auth/passwordRules'
import { ApiError, getErrorMessage } from '@/lib/api/errors'
import { displayName } from '@/lib/names'

import { setStaffPassword, type StaffMember } from './api'

/** Owner / manager sets a new password for a staff member who can't reset it. */
export function SetPasswordDialog({
  member,
  onClose,
}: {
  member: StaffMember | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const rules = member
    ? checkPassword(password, {
        personal: [member.username, member.first_name, member.last_name, member.email],
      })
    : []
  const name = member ? displayName(member) : ''
  const passwordError =
    submitted && !passwordIsAcceptable(rules) ? t('password.newInvalid') : undefined
  const confirmError = submitted && password !== confirm ? t('password.mismatch') : undefined

  function close() {
    setPassword('')
    setConfirm('')
    setSubmitted(false)
    setServerError(null)
    onClose()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (!member || !passwordIsAcceptable(rules) || password !== confirm) return
    setPending(true)
    setServerError(null)
    try {
      await setStaffPassword(member.id, password)
      toast.success(t('staff.passwordSet', { name }))
      close()
    } catch (error) {
      setServerError(
        error instanceof ApiError && error.fieldErrors.new_password
          ? error.fieldErrors.new_password.join(' ')
          : getErrorMessage(error),
      )
    } finally {
      setPending(false)
    }
  }

  const passwordProps = { showLabel: t('auth.showPassword'), hideLabel: t('auth.hidePassword') }
  return (
    <Dialog
      open={member !== null}
      onClose={close}
      dismissible={!pending}
      title={t('staff.setPasswordTitle', { name })}
      description={t('staff.setPasswordBody')}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={pending}>
            {t('changePassword.cancel')}
          </Button>
          <Button type="submit" form="set-password-form" loading={pending}>
            {t('staff.setPassword')}
          </Button>
        </>
      }
    >
      {serverError && (
        <Alert tone="danger" className="mb-4">
          {serverError}
        </Alert>
      )}
      <form
        id="set-password-form"
        onSubmit={(e) => void submit(e)}
        noValidate
        className="flex flex-col gap-4"
      >
        <PasswordField
          label={t('password.new')}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="set-password-rules"
          error={passwordError}
          {...passwordProps}
        />
        <PasswordRequirements id="set-password-rules" results={rules} />
        <PasswordField
          label={t('password.confirmPlain')}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={confirmError}
          {...passwordProps}
        />
      </form>
    </Dialog>
  )
}
