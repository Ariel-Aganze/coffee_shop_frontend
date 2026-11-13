/** Settings page: profile, logo, regional preferences, POS limit and currency change. */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tokens } from '@/lib/api/tokens'
import { fixtures, json, mockApi, shellHandlers } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

function settingsHandlers(
  role: string,
  extra: Record<string, (r: Request) => Response | Promise<Response>> = {},
) {
  tokens.set('a', 'r')
  const user = fixtures.user(role)
  return {
    ...shellHandlers(user),
    'POST /api/auth/token/refresh/': () => json({ access: 'a2', refresh: 'r2' }),
    'GET /api/settings/currencies/': () => json(fixtures.currencies),
    'GET /api/settings/me/currency-history/': () => json([]),
    ...extra,
  }
}

beforeEach(() => {
  localStorage.clear()
  tokens.clear()
})
afterEach(() => tokens.clear())

describe('settings page', () => {
  it('saves only changed business profile fields', async () => {
    const calls = mockApi(
      settingsHandlers('owner', {
        'PATCH /api/businesses/me/': async (req) =>
          json({ ...fixtures.business, ...(await req.json()) }),
      }),
    )
    const { user } = renderApp('/settings')
    const card = (await screen.findByRole('heading', { name: 'Business profile' })).closest(
      'section',
    )!
    const phone = within(card).getByLabelText('Contact phone')
    await user.type(phone, '+250 788 123 456')
    await user.click(within(card).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true))
    const patch = calls.find((c) => c.method === 'PATCH')!
    expect(await patch.request.json()).toEqual({ contact_phone: '+250 788 123 456' })
  })

  it('refuses an oversized logo before uploading', async () => {
    const calls = mockApi(settingsHandlers('owner'))
    const { user } = renderApp('/settings')
    await screen.findByRole('heading', { name: 'Business profile' })
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'logo.png', { type: 'image/png' })
    await user.upload(input, big)
    expect(await screen.findByText('The logo must be 2 MB or smaller.')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false)
  })

  it('previews and saves regional preferences', async () => {
    const calls = mockApi(
      settingsHandlers('owner', {
        'PATCH /api/settings/me/': async (req) =>
          json({ ...fixtures.settings, ...(await req.json()) }),
      }),
    )
    const { user } = renderApp('/settings')
    const card = (await screen.findByRole('heading', { name: 'Regional preferences' })).closest(
      'section',
    )!
    await user.selectOptions(within(card).getByLabelText('Number format'), '1.234,56')
    expect(within(card).getByText(/1\.250\.001/)).toBeInTheDocument() // live preview, e.g. "1.250.001 RWF"
    await user.click(within(card).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true))
    const body = await calls.find((c) => c.method === 'PATCH')!.request.json()
    expect(body.number_format).toBe('1.234,56')
  })

  it('validates the cashier discount limit', async () => {
    mockApi(settingsHandlers('owner'))
    const { user } = renderApp('/settings')
    const field = await screen.findByLabelText('Largest discount a cashier can give')
    await user.clear(field)
    await user.type(field, '150')
    const card = field.closest('section')!
    await user.click(within(card).getByRole('button', { name: 'Save changes' }))
    expect(
      within(card).getByText('Enter a number from 0 to 100 (up to 2 decimals).'),
    ).toBeInTheDocument()
  })

  it('only the owner can change the currency', async () => {
    mockApi(settingsHandlers('admin'))
    renderApp('/settings')
    expect(
      await screen.findByText('Only the business owner can change the currency.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change currency' })).not.toBeInTheDocument()
  })
})

describe('currency change', () => {
  it('explains the impact, needs confirmation, then switches', async () => {
    const calls = mockApi(
      settingsHandlers('owner', {
        'GET /api/cash-sessions/': () =>
          json({ count: 2, next: null, previous: null, results: [] }),
        'POST /api/settings/me/change-currency/': () =>
          json({ ...fixtures.settings, primary_currency: fixtures.currencies[2] }),
      }),
    )
    const { user } = renderApp('/settings')
    await user.click(await screen.findByRole('button', { name: 'Change currency' }))
    const dialog = await screen.findByRole('dialog', { name: 'Change currency' })

    // The current currency isn't offered.
    expect(within(dialog).queryByRole('radio', { name: /RWF/ })).not.toBeInTheDocument()
    await user.click(await within(dialog).findByRole('radio', { name: /USD/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))

    expect(within(dialog).getByText(/keep their amounts in RWF/)).toBeInTheDocument()
    expect(
      within(dialog).getByText(/RWF\s2,500 will be charged as USD\s2,500\.00/),
    ).toBeInTheDocument()
    expect(await within(dialog).findByText(/2 cash drawers are still open/)).toBeInTheDocument()

    const confirm = within(dialog).getByRole('button', { name: 'Switch to USD' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Reason (optional)'), 'Moving to Kenya HQ')
    await user.click(within(dialog).getByRole('checkbox'))
    await user.click(confirm)

    await waitFor(() =>
      expect(calls.some((c) => c.path === '/api/settings/me/change-currency/')).toBe(true),
    )
    const body = await calls
      .find((c) => c.path === '/api/settings/me/change-currency/')!
      .request.json()
    expect(body).toEqual({ currency_code: 'USD', confirm: true, reason: 'Moving to Kenya HQ' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('US Dollar', { exact: false })).toBeInTheDocument()
  })
})
