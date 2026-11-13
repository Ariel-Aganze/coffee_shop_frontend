import type { QueryClient } from '@tanstack/react-query'

import { businessKeys } from '@/features/business/api'
import { api, unwrap } from '@/lib/api/client'
import type { operations, Schema } from '@/lib/api/types'

export type Branch = Schema<'Branch'>
export type BranchInput = Schema<'BranchRequest'>
export type BranchListParams = NonNullable<operations['branches_list']['parameters']['query']>

export const branchKeys = {
  all: ['branches'] as const,
  list: (params: BranchListParams) => ['branches', 'list', params] as const,
}

export const fetchBranchPage = (params: BranchListParams) =>
  unwrap(api.GET('/api/branches/', { params: { query: params } }))

export const createBranch = (input: BranchInput) =>
  unwrap(api.POST('/api/branches/', { body: input }))

export const updateBranch = (id: number, input: Schema<'PatchedBranchRequest'>) =>
  unwrap(api.PATCH('/api/branches/{id}/', { params: { path: { id } }, body: input }))

export const deactivateBranch = (id: number) =>
  unwrap(api.DELETE('/api/branches/{id}/', { params: { path: { id } } }))

/** After any branch change: refresh lists and the header's branch picker. */
export function invalidateBranches(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: branchKeys.all })
  void queryClient.invalidateQueries({ queryKey: businessKeys.branches })
}
