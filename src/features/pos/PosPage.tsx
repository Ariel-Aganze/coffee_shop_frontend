import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, ShoppingBag, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ListError } from '@/components/feedback/ListStates'
import { Loader } from '@/components/feedback/Loader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCurrentUser } from '@/features/auth/useAuth'
import { useBusiness } from '@/features/business/useBusiness'
import { cashKeys, fetchMyOpenSession } from '@/features/cash/api'
import { OpenDrawerDialog } from '@/features/cash/OpenDrawerDialog'
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import { fromMinor } from '@/lib/minor'

import { fetchCatalog, posKeys, type Sale } from './api'
import {
  addProduct,
  loadCart,
  priceLines,
  saveCart,
  setDiscount,
  setQuantity,
  toSaleItems,
  totals as cartTotals,
  type CartLine,
  type PricedLine,
} from './cart'
import { CartPanel } from './CartPanel'
import { CheckoutDialog } from './CheckoutDialog'
import { DiscountDialog } from './DiscountDialog'
import { ProductGrid } from './ProductGrid'
import { SaleDoneDialog } from './SaleDoneDialog'

/** Random key that also works on plain-http LAN addresses (no crypto.randomUUID there). */
function newAttemptKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Point of sale (SRS 5.5): pick products, take payment, print the receipt. */
export function PosPage() {
  const { t } = useTranslation()
  const { branch, branches, setBranchId } = useBusiness()

  if (!branch) {
    // Owners viewing "All branches" choose where they are selling.
    return (
      <Card className="mx-auto w-full max-w-lg p-6">
        <EmptyState
          icon={Store}
          title={t('pos.chooseBranchTitle')}
          description={t('pos.chooseBranchBody')}
        />
        <ul className="mt-2 flex flex-col gap-2">
          {branches.map((b) => (
            <li key={b.id}>
              <Button variant="secondary" className="w-full" onClick={() => setBranchId(b.id)}>
                {b.name}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    )
  }
  // Keyed so the cart and dialogs reset when the branch changes.
  return <PosRegister key={branch.id} branch={branch} />
}

function PosRegister({ branch }: { branch: { id: number; name: string } }) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { format } = useBusiness()
  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery(MD_UP)
  const decimals = format.settings.currencyDecimals

  const catalog = useQuery({
    queryKey: posKeys.catalog(branch.id),
    queryFn: () => fetchCatalog(branch.id),
    refetchInterval: 60_000, // prices, stock and availability change during the day
  })
  const drawer = useQuery({
    queryKey: cashKeys.mine(branch.id, user.id),
    queryFn: () => fetchMyOpenSession(branch.id, user.id),
  })

  const [lines, setLinesState] = useState<CartLine[]>(() => loadCart(branch.id))
  // A checkout attempt is identified by this key until the cart changes or the sale succeeds.
  const [attemptKey, setAttemptKey] = useState(newAttemptKey)
  const setLines = (next: CartLine[]) => {
    setLinesState(next)
    setAttemptKey(newAttemptKey())
  }
  useEffect(() => saveCart(branch.id, lines), [branch.id, lines])

  const [checkingOut, setCheckingOut] = useState(false)
  const [discountLine, setDiscountLine] = useState<PricedLine | null>(null)
  const [openingDrawer, setOpeningDrawer] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [done, setDone] = useState<{ sale: Sale; change: bigint } | null>(null)

  if (catalog.isPending) return <Loader label={t('app.loading')} />
  if (catalog.isError) {
    return (
      <Card>
        <ListError error={catalog.error} onRetry={() => void catalog.refetch()} />
      </Card>
    )
  }

  const data = catalog.data
  const byId = new Map(data.products.map((p) => [p.id, p]))
  const priced = priceLines(lines, byId, data.discount, decimals)
  const totals = cartTotals(priced)
  const inCart = new Map(lines.map((l) => [l.productId, l.quantity]))
  const canDiscount = data.discount.unlimited || Number(data.discount.max_percent) > 0
  const session = drawer.data ?? null

  const cart = (
    <CartPanel
      lines={priced}
      totals={totals}
      canDiscount={canDiscount}
      onQuantity={(id, q) => setLines(setQuantity(lines, id, q))}
      onDiscount={setDiscountLine}
      onClear={() => setLines([])}
      onCharge={() => {
        setCartOpen(false)
        setCheckingOut(true)
      }}
      showTitle={isDesktop}
      className={isDesktop ? 'sticky top-24 max-h-[calc(100dvh-7.5rem)]' : 'border-0 shadow-none'}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Drawer status: cash can only be taken into an open drawer (CASH-004). */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3 text-sm shadow-card">
        <span className="flex items-center gap-2 text-ink">
          <Banknote className="size-4 text-ink-muted" aria-hidden="true" />
          {drawer.isPending
            ? t('app.loading')
            : session
              ? t('pos.drawerOpen', {
                  branch: branch.name,
                  since: format.time(session.opened_at),
                  cash: format.money(session.live_expected_cash),
                })
              : t('pos.drawerClosed', { branch: branch.name })}
        </span>
        {session ? (
          <Link to={`/cash/${session.id}`} className="font-medium text-primary hover:underline">
            {t('pos.manageDrawer')}
          </Link>
        ) : (
          !drawer.isPending && (
            <Button size="sm" variant="soft" onClick={() => setOpeningDrawer(true)}>
              {t('cash.open')}
            </Button>
          )
        )}
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <ProductGrid
          catalog={data}
          inCart={inCart}
          onAdd={(product) => setLines(addProduct(lines, product))}
        />
        {isDesktop && cart}
      </div>

      {!isDesktop && (
        <>
          {/* Phones: the cart lives behind a bar pinned to the bottom. */}
          <div className="h-20" aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 p-3 backdrop-blur">
            <Button
              size="lg"
              className="w-full justify-between"
              onClick={() => setCartOpen(true)}
              leadingIcon={<ShoppingBag className="size-5" aria-hidden="true" />}
            >
              <span className="flex-1 text-left">
                {t('pos.viewCart', { count: totals.itemCount })}
              </span>
              <span className="tabular-nums">
                {format.money(fromMinor(totals.total, decimals))}
              </span>
            </Button>
          </div>
          <Dialog open={cartOpen} onClose={() => setCartOpen(false)} title={t('pos.cart')}>
            {cart}
          </Dialog>
        </>
      )}

      <DiscountDialog
        line={discountLine}
        allowance={data.discount}
        onClose={() => setDiscountLine(null)}
        onApply={(id, discount) => setLines(setDiscount(lines, id, discount))}
      />
      <CheckoutDialog
        open={checkingOut}
        onClose={() => setCheckingOut(false)}
        due={totals.total}
        items={toSaleItems(priced, decimals)}
        branchId={branch.id}
        methods={data.payment_methods}
        drawerOpen={session !== null}
        onOpenDrawer={() => setOpeningDrawer(true)}
        idempotencyKey={attemptKey}
        onDone={(sale, change) => {
          setCheckingOut(false)
          setLinesState([])
          setAttemptKey(newAttemptKey())
          setDone({ sale, change })
          // Stock and the drawer's cash just changed.
          void queryClient.invalidateQueries({ queryKey: posKeys.catalog(branch.id) })
          void queryClient.invalidateQueries({ queryKey: cashKeys.all })
          void queryClient.invalidateQueries({ queryKey: ['sales'] })
        }}
      />
      <SaleDoneDialog
        sale={done?.sale ?? null}
        change={done?.change ?? 0n}
        onNewSale={() => setDone(null)}
      />
      <OpenDrawerDialog
        open={openingDrawer}
        onClose={() => setOpeningDrawer(false)}
        branch={branch}
      />
    </div>
  )
}
