import { api, unwrap } from '@/lib/api/client'
import type { Schema } from '@/lib/api/types'

export type Business = Schema<'Business'>
export type BusinessSettings = Schema<'BusinessSettings'>
export type Branch = Schema<'Branch'>

export const businessKeys = {
  profile: ['business', 'profile'] as const,
  settings: ['business', 'settings'] as const,
  branches: ['business', 'branches'] as const,
}

export const fetchBusiness = () => unwrap(api.GET('/api/businesses/me/'))
export const fetchSettings = () => unwrap(api.GET('/api/settings/me/'))

/** Branches visible to the user (the API scopes them by role). A business has
 *  a handful of branches, so one page of 100 covers it. */
export async function fetchBranches(): Promise<Branch[]> {
  const page = await unwrap(api.GET('/api/branches/', { params: { query: { page_size: 100 } } }))
  return page.results
}

// ---------------------------------------------------------------- onboarding & settings
export type Currency = Schema<'Currency'>
export type RegistrationInput = Schema<'BusinessRegistrationRequest'>
export type SettingsInput = Schema<'PatchedBusinessSettingsRequest'>
export type BusinessInput = Schema<'PatchedBusinessRequest'>
export type CurrencyChange = Schema<'CurrencyChangeLog'>

export const currencyKeys = { all: ['currencies'] as const }

/** The ISO 4217 catalogue (public: the registration wizard needs it). */
export const fetchCurrencies = () => unwrap(api.GET('/api/settings/currencies/'))

export const registerBusiness = (input: RegistrationInput) =>
  unwrap(api.POST('/api/businesses/register/', { body: input }))

export const updateBusiness = (input: BusinessInput) =>
  unwrap(api.PATCH('/api/businesses/me/', { body: input }))

/** Upload a new logo (multipart: the browser sets the boundary). */
export function uploadLogo(file: File) {
  const form = new FormData()
  form.append('logo', file)
  return unwrap(api.PATCH('/api/businesses/me/', { body: form as unknown as BusinessInput }))
}

export const removeLogo = () => updateBusiness({ logo: null })

export const updateSettings = (input: SettingsInput) =>
  unwrap(api.PATCH('/api/settings/me/', { body: input }))

export const changeCurrency = (currencyCode: string, reason: string) =>
  unwrap(
    api.POST('/api/settings/me/change-currency/', {
      body: { currency_code: currencyCode, confirm: true, reason },
    }),
  )

export const currencyHistoryKey = ['business', 'currency-history'] as const
export const fetchCurrencyHistory = () => unwrap(api.GET('/api/settings/me/currency-history/'))

/** How many cash drawers are open right now (relevant before a currency change). */
export async function countOpenCashSessions(): Promise<number> {
  const page = await unwrap(
    api.GET('/api/cash-sessions/', { params: { query: { status: 'open', page_size: 1 } } }),
  )
  return page.count
}
