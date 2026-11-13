import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/TextField'
import { getErrorMessage } from '@/lib/api/errors'

import { asUnit, invalidateStock, setThreshold, type StockRow } from './api'
import { parseQuantity, useQuantity } from './useQuantity'

/** Minimum stock for low-stock alerts (INV-009, INV-010). */
export function ThresholdDialog({ row, onClose }: { row: StockRow | null; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const quantityText = useQuantity()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [forRow, setForRow] = useState<number | null>(null)
  if (row && row.id !== forRow) {
    setForRow(row.id)
    setValue(String(Number(row.minimum_threshold)))
    setError(null)
    setFormError(null)
  }
  if (!row) return null

  async function submit() {
    const qty = parseQuantity(value, row!.product_unit)
    if (qty === null) {
      return setError(
        t('stock.quantityInvalid', { unit: t(`units.long.${asUnit(row!.product_unit)}`) }),
      )
    }
    setPending(true)
    try {
      await setThreshold(row!.id, qty)
      toast.success(t('stock.thresholdSaved', { name: row!.product_name }))
      invalidateStock(queryClient, row!.branch)
      onClose()
    } catch (e) {
      setFormError(getErrorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!pending}
      title={t('stock.thresholdTitle', { name: row.product_name })}
      description={t('stock.thresholdBody', {
        quantity: quantityText(row.quantity, row.product_unit),
        branch: row.branch_name,
      })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {t('changePassword.cancel')}
          </Button>
          <Button type="submit" form="threshold-form" loading={pending}>
            {t('profile.save')}
          </Button>
        </>
      }
    >
      {formError && (
        <Alert tone="danger" className="mb-4">
          {formError}
        </Alert>
      )}
      <form
        id="threshold-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <TextField
          label={t('stock.minimum')}
          hint={t('stock.minimumHint')}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          trailing={
            <span className="pr-3 text-sm text-ink-muted">
              {t(`units.symbol.${asUnit(row.product_unit)}`)}
            </span>
          }
          error={error ?? undefined}
        />
      </form>
    </Dialog>
  )
}
