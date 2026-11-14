/** Reports: who sees which, filters → query, totals and file export. */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { tokens } from '@/lib/api/tokens'
import { fixtures, json, mockApi, shellHandlers } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

type Handlers = Record<string, (r: Request) => Response | Promise<Response>>

const byBranch = {
  period: { from: '2026-11-01', to: '2026-11-14' },
  results: [
    {
      branch_id: 1,
      branch_name: 'Kigali Heights',
      currency_code: 'RWF',
      total_sales: '1000.0000',
      refunds_total: '100.0000',
      net_sales: '900.0000',
      transactions: 3,
    },
    {
      branch_id: 2,
      branch_name: 'Nyarutarama',
      currency_code: 'RWF',
      total_sales: '500.0000',
      refunds_total: '0.0000',
      net_sales: '500.0000',
      transactions: 2,
    },
  ],
}

function setup(role: string, extra: Handlers = {}) {
  tokens.set('a', 'r')
  return mockApi({
    ...shellHandlers(fixtures.user(role)),
    'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    'GET /api/reports/sales/by-branch/': (req) =>
      new URL(req.url).searchParams.get('export') === 'csv'
        ? new Response('Report,Sales by branch', {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition':
                'attachment; filename="sales-by-branch_2026-11-01_2026-11-14.csv"',
            },
          })
        : json(byBranch),
    ...extra,
  })
}
const query = (calls: ReturnType<typeof mockApi>, path: string) =>
  Object.fromEntries(new URL(calls.filter((c) => c.path === path).at(-1)!.request.url).searchParams)

beforeEach(() => {
  localStorage.clear()
  tokens.clear()
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-14T08:00:00Z') })
})
afterEach(() => {
  tokens.clear()
  vi.useRealTimers()
})

describe('reports index', () => {
  it('offers each role only what it may open', async () => {
    setup('cashier')
    const cashier = renderApp('/reports')
    expect(await screen.findByRole('link', { name: /Sales summary/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Sales by employee/ })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Inventory' })).toBeNull()
    cashier.unmount()

    setup('inventory_manager')
    renderApp('/reports')
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sales' })).toBeNull()
  })
})

describe('a report', () => {
  it('asks for the period and branch, totals the rows and exports a file', async () => {
    const calls = setup('owner')
    const { user } = renderApp('/reports/sales-by-branch')
    const table = await screen.findByRole('table')
    expect(query(calls, '/api/reports/sales/by-branch/')).toEqual({
      from: '2026-11-01',
      to: '2026-11-14',
    })
    const totals = within(table).getByText('Total').closest('tr')!
    expect(within(totals).getByText(/RWF\s1,400/)).toBeInTheDocument() // net 900 + 500
    expect(within(totals).getByText('5')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'This week' }))
    await waitFor(() =>
      expect(query(calls, '/api/reports/sales/by-branch/')).toEqual({
        from: '2026-11-09',
        to: '2026-11-14',
      }),
    )

    const saved: string[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push(this.download)
    })
    await user.click(screen.getByRole('button', { name: 'Excel / CSV' }))
    // Saved under the server's file name.
    await waitFor(() => expect(saved).toEqual(['sales-by-branch_2026-11-01_2026-11-14.csv']))
    expect(query(calls, '/api/reports/sales/by-branch/')).toMatchObject({ export: 'csv' })
    click.mockRestore()
  })

  it('refuses a report the role may not open', async () => {
    setup('cashier')
    renderApp('/reports/financial-summary')
    expect(await screen.findByText('Report not available')).toBeInTheDocument()
  })
})
