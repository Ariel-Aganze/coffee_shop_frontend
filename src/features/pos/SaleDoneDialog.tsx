import { useMutation } from '@tanstack/react-query'
import { CircleCheck, Download, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useFormat } from '@/features/business/useBusiness'
import { downloadReceipt, printReceipt } from '@/features/sales/receipt'
import { getErrorMessage } from '@/lib/api/errors'
import { fromMinor } from '@/lib/minor'

import type { Sale } from './api'

interface SaleDoneDialogProps {
  sale: Sale | null
  change: bigint
  onNewSale: () => void
}

/** Sale recorded: change to hand back, receipt, next customer (POS-015, POS-016). */
export function SaleDoneDialog({ sale, change, onNewSale }: SaleDoneDialogProps) {
  const { t } = useTranslation()
  const format = useFormat()
  const print = useMutation({
    mutationFn: (id: number) => printReceipt(id),
    onError: (error) => toast.error(getErrorMessage(error)),
    meta: { silentError: true },
  })
  const download = useMutation({
    mutationFn: (s: Sale) => downloadReceipt(s.id, s.transaction_number),
    onError: (error) => toast.error(getErrorMessage(error)),
    meta: { silentError: true },
  })
  if (!sale) return null

  return (
    <Dialog
      open
      onClose={onNewSale}
      title={t('pos.doneTitle')}
      footer={
        <Button size="lg" className="w-full sm:w-auto" onClick={onNewSale}>
          {t('pos.newSale')}
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <CircleCheck className="size-12 text-success" aria-hidden="true" />
        <p className="text-sm text-ink-muted">
          {t('pos.doneBody', {
            number: sale.transaction_number,
            total: format.money(sale.total_amount),
          })}
        </p>
        {change > 0n && (
          <div className="w-full rounded-xl bg-success-soft px-4 py-3">
            <p className="text-sm font-medium text-success">{t('pos.changeDue')}</p>
            <p className="text-3xl font-semibold text-success tabular-nums">
              {format.money(fromMinor(change, format.settings.currencyDecimals))}
            </p>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <Button
            variant="secondary"
            loading={print.isPending}
            onClick={() => print.mutate(sale.id)}
            leadingIcon={<Printer className="size-4" aria-hidden="true" />}
          >
            {t('pos.printReceipt')}
          </Button>
          <Button
            variant="ghost"
            loading={download.isPending}
            onClick={() => download.mutate(sale)}
            leadingIcon={<Download className="size-4" aria-hidden="true" />}
          >
            {t('pos.downloadReceipt')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
