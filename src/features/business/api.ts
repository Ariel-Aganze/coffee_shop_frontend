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
