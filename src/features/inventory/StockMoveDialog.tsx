import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField } from '@/components/ui/SelectField'
import { TextField } from '@/components/ui/TextField'
import { useBusiness } from '@/features/business/useBusiness'
import type { Product } from '@/features/products/api'
import { ApiError, getErrorMessage } from '@/lib/api/errors'

import {
  asUnit,
  INFLOW_TYPES,
  invalidateStock,
  OUTFLOW_TYPES,
  receiveStock,
  removeStock,
  type InflowType,
  type OutflowType,
  type StockRow,
} from './api'
import { ProductPicker } from './ProductPicker'
import { parseQuantity, useQuantity } from './useQuantity'

type Direction = 'in' | 'out'

interface StockMoveDialogProps {
  direction: Direction
  open: boolean
  onClose: () => void
  /** Opened from a stock row: product and branch are fixed. */
  row?: StockRow | null
}

/** Types whose reason the backend requires (BRULE-009). */
const NEEDS_REASON = new Set(['adjustment', 'damaged', 'expired'])

/** Receive stock (INV-004) or take it out as damaged / expired / corrected (INV-005, INV-011). */
export function StockMoveDialog({ direction, open, onClose, row }: StockMoveDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const quantityText = useQuantity()
  const { branch, branches } = useBusiness()
  const types = direction === 'in' ? INFLOW_TYPES : OUTFLOW_TYPES

  const [product, setProduct] = useState<Product | null>(null)
  const [branchId, setBranchId] = useState('')
  const [type, setType] = useState<string>(types[0])
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [reference, setReference] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  const unit = row ? row.product_unit : (product?.unit ?? 'each')
  const targetBranch = row?.branch ?? branch?.id ?? (branchId ? Number(branchId) : null)

  function close() {
    setProduct(null)
    setBranchId('')
    setType(types[0])
    setQuantity('')
    setReason('')
    setReference('')
    setErrors({})
    onClose()
  }

  async function submit() {
    const next: Record<string, string> = {}
    const productId = row?.product ?? product?.id
    if (!productId) next.product = t('stock.productRequired')
    if (!targetBranch) next.branch = t('stock.branchRequired')
    const qty = parseQuantity(quantity, unit)
    if (qty === null || Number(qty) <= 0) {
      next.quantity = t('stock.quantityInvalid', { unit: t(`units.long.${asUnit(unit)}`) })
    } else if (direction === 'out' && row && Number(qty) > Number(row.quantity)) {
      next.quantity = t('stock.notEnough', { quantity: quantityText(row.quantity, unit) })
    }
    if (NEEDS_REASON.has(type) && !reason.trim()) next.reason = t('stock.reasonRequired')
    setErrors(next)
    if (Object.keys(next).length) return

    setPending(true)
    try {
      const body = {
        branch: targetBranch!,
        product_id: productId!,
        quantity: qty!,
        reason: reason.trim(),
        reference: reference.trim(),
      }
      if (direction === 'in') await receiveStock({ ...body, movement_type: type as InflowType })
      else await removeStock({ ...body, movement_type: type as OutflowType })
      toast.success(
        direction === 'in'
          ? t('stock.received', { quantity: quantityText(qty!, unit) })
          : t('stock.removed', { quantity: quantityText(qty!, unit) }),
      )
      invalidateStock(queryClient, targetBranch!)
      close()
    } catch (error) {
      const fields = error instanceof ApiError ? error.fieldErrors : {}
      setErrors({
        form: getErrorMessage(error),
        ...(fields.quantity ? { quantity: fields.quantity.join(' ') } : {}),
      })
    } finally {
      setPending(false)
    }
  }

  const name = row?.product_name ?? product?.name
  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!pending}
      size={row ? 'md' : 'lg'}
      title={
        direction === 'in'
          ? name
            ? t('stock.receiveTitleFor', { name })
            : t('stock.receiveTitle')
          : t('stock.removeTitle', { name: name ?? '' })
      }
      description={
        row
          ? t('stock.onHandAt', {
              quantity: quantityText(row.quantity, row.product_unit),
              branch: row.branch_name,
            })
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={pending}>
            {t('changePassword.cancel')}
          </Button>
          <Button
            type="submit"
            form="stock-move-form"
            loading={pending}
            variant={direction === 'out' ? 'danger' : 'primary'}
          >
            {direction === 'in' ? t('stock.receive') : t('stock.remove')}
          </Button>
        </>
      }
    >
      {errors.form && (
        <Alert tone="danger" className="mb-4">
          {errors.form}
        </Alert>
      )}
      <form
        id="stock-move-form"
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        {!row && (
          <div className="sm:col-span-2">
            <ProductPicker value={product} onChange={setProduct} error={errors.product} />
          </div>
        )}
        {!row && !branch && (
          <SelectField
            className="sm:col-span-2"
            label={t('stock.branch')}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            error={errors.branch}
          >
            <option value="">{t('stock.chooseBranch')}</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </SelectField>
        )}
        <SelectField
          label={t('stock.movementType')}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {types.map((value) => (
            <option key={value} value={value}>
              {t(`stock.types.${value}`)}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t('stock.quantity')}
          inputMode="decimal"
          autoComplete="off"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          trailing={
            <span className="pr-3 text-sm text-ink-muted">{t(`units.symbol.${asUnit(unit)}`)}</span>
          }
          error={errors.quantity}
        />
        <TextField
          className="sm:col-span-2"
          label={NEEDS_REASON.has(type) ? t('stock.reason') : t('stock.reasonOptional')}
          placeholder={t(
            `stock.reasonPlaceholder.${type as (typeof INFLOW_TYPES)[number] | (typeof OUTFLOW_TYPES)[number]}`,
          )}
          autoComplete="off"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={errors.reason}
        />
        <TextField
          className="sm:col-span-2"
          label={t('stock.reference')}
          hint={direction === 'in' ? t('stock.referenceHint') : undefined}
          autoComplete="off"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </form>
    </Dialog>
  )
}
