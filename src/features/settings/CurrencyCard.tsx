import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Coins, History, Lock } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { can } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/auth/useAuth'
import {
  businessKeys,
  changeCurrency,
  countOpenCashSessions,
  currencyHistoryKey,
  currencyKeys,
  fetchCurrencies,
  fetchCurrencyHistory,
  type BusinessSettings,
} from '@/features/business/api'
import { useFormat } from '@/features/business/useBusiness'

import { CurrencyPicker } from './CurrencyPicker'

const SAMPLE_PRICE = '2500'

/** Primary currency (SRS 5.14): current currency, guarded change flow, history. */
export function CurrencyCard({ settings }: { settings: BusinessSettings }) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const format = useFormat()
  const [open, setOpen] = useState(false)
  const currency = settings.primary_currency
  const history = useQuery({ queryKey: currencyHistoryKey, queryFn: fetchCurrencyHistory })

  return (
    <Card>
      <CardHeader
        title={t('currency.title')}
        description={t('currency.hint')}
        actions={
          can(user.role, 'currency.change') ? (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              {t('currency.change')}
            </Button>
          ) : undefined
        }
      />
      <CardBody className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-peach text-primary">
            <Coins className="size-7" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xl font-semibold text-ink">
              {currency.code} <span className="font-normal text-ink-muted">· {currency.name}</span>
            </p>
            <p className="text-sm text-ink-muted">
              {t('currency.details', {
                symbol: currency.symbol,
                decimals: currency.decimal_places,
              })}
            </p>
          </div>
        </div>

        {!can(user.role, 'currency.change') && (
          <p className="flex items-start gap-2 text-sm text-ink-muted">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t('currency.ownerOnly')}
          </p>
        )}

        <section aria-labelledby="currency-history">
          <h3
            id="currency-history"
            className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"
          >
            <History className="size-4 text-ink-muted" aria-hidden="true" />
            {t('currency.history')}
          </h3>
          {history.data && history.data.length > 0 ? (
            <ul className="divide-y divide-border rounded-control border border-border">
              {history.data.map((change) => (
                <li
                  key={change.id}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex items-center gap-2 font-medium text-ink">
                    {change.old_currency.code}
                    <ArrowRight className="size-4 text-ink-muted" aria-label={t('currency.to')} />
                    {change.new_currency.code}
                    {change.reason && (
                      <span className="truncate font-normal text-ink-muted">— {change.reason}</span>
                    )}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {format.dateTime(change.changed_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">
              {history.isPending ? t('app.loading') : t('currency.noHistory')}
            </p>
          )}
        </section>
      </CardBody>

      <CurrencyChangeDialog open={open} onClose={() => setOpen(false)} settings={settings} />
    </Card>
  )
}

function CurrencyChangeDialog({
  open,
  onClose,
  settings,
}: {
  open: boolean
  onClose: () => void
  settings: BusinessSettings
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const format = useFormat()
  const confirmId = useId()
  const [stage, setStage] = useState<'pick' | 'confirm'>('pick')
  const [code, setCode] = useState('')
  const [reason, setReason] = useState('')
  const [understood, setUnderstood] = useState(false)
  const current = settings.primary_currency

  const currencies = useQuery({
    queryKey: currencyKeys.all,
    queryFn: fetchCurrencies,
    staleTime: Infinity,
  })
  const openDrawers = useQuery({
    queryKey: ['cash-sessions', 'open-count'],
    queryFn: countOpenCashSessions,
    enabled: open && stage === 'confirm',
  })
  const target = currencies.data?.find((c) => c.code === code)

  const mutation = useMutation({
    mutationFn: () => changeCurrency(code, reason.trim()),
    onSuccess: (updated) => {
      queryClient.setQueryData(businessKeys.settings, updated)
      void queryClient.invalidateQueries({ queryKey: currencyHistoryKey })
      toast.success(t('currency.changed', { code }))
      close()
    },
    meta: { silentError: true },
  })

  function close() {
    setStage('pick')
    setCode('')
    setReason('')
    setUnderstood(false)
    mutation.reset()
    onClose()
  }

  const priceOld = format.money(SAMPLE_PRICE)
  const priceNew = target
    ? format.money(SAMPLE_PRICE, { currency: target.code, decimals: target.decimal_places })
    : ''
  const drawers = openDrawers.data ?? 0

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      dismissible={!mutation.isPending}
      title={t('currency.changeTitle')}
      description={stage === 'pick' ? t('currency.pickHint', { code: current.code }) : undefined}
      footer={
        stage === 'pick' ? (
          <>
            <Button variant="ghost" onClick={close}>
              {t('changePassword.cancel')}
            </Button>
            <Button disabled={!code} onClick={() => setStage('confirm')}>
              {t('onboarding.next')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStage('pick')} disabled={mutation.isPending}>
              {t('onboarding.back')}
            </Button>
            <Button
              variant="danger"
              disabled={!understood}
              loading={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {t('currency.confirm', { code })}
            </Button>
          </>
        )
      }
    >
      {stage === 'pick' ? (
        <CurrencyPicker
          legend={t('currency.newCurrency')}
          value={code}
          onChange={setCode}
          exclude={current.code}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Badge tone="neutral" className="text-sm">
              {current.code}
            </Badge>
            <ArrowRight className="size-5 text-ink-muted" aria-label={t('currency.to')} />
            <Badge tone="brand" className="text-sm">
              {code}
            </Badge>
            <span className="truncate text-base font-normal text-ink-muted">{target?.name}</span>
          </p>

          <ul className="flex flex-col gap-3 text-sm text-ink">
            <li>{t('currency.impactHistory', { old: current.code })}</li>
            <li>{t('currency.impactNew', { new: code })}</li>
            <li className="rounded-control bg-warning-soft px-3.5 py-3 text-warning">
              <strong className="block">{t('currency.impactPricesTitle')}</strong>
              {t('currency.impactPrices', { old: priceOld, new: priceNew })}
            </li>
          </ul>

          {drawers > 0 && (
            <Alert tone="danger">
              {t('currency.openDrawers', { count: drawers, old: current.code })}
            </Alert>
          )}

          <TextAreaField
            label={t('currency.reason')}
            hint={t('currency.reasonHint')}
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          <label
            htmlFor={confirmId}
            className="flex cursor-pointer items-start gap-3 text-sm text-ink"
          >
            <input
              id={confirmId}
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            {t('currency.understand', { old: current.code, new: code })}
          </label>

          {mutation.error && <Alert tone="danger">{mutation.error.message}</Alert>}
        </div>
      )}
    </Dialog>
  )
}
