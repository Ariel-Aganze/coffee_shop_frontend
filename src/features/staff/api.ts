import { api, unwrap } from '@/lib/api/client'
import type { operations, Schema } from '@/lib/api/types'

export type StaffMember = Schema<'User'>
export type StaffListParams = NonNullable<operations['auth_users_list']['parameters']['query']>

export const staffKeys = {
  all: ['staff'] as const,
  list: (params: StaffListParams) => ['staff', 'list', params] as const,
}

export const fetchStaffPage = (params: StaffListParams) =>
  unwrap(api.GET('/api/auth/users/', { params: { query: params } }))

export const createStaff = (input: Schema<'UserCreateRequest'>) =>
  unwrap(api.POST('/api/auth/users/', { body: input }))

export const updateStaff = (id: number, input: Schema<'PatchedUserUpdateRequest'>) =>
  unwrap(api.PATCH('/api/auth/users/{id}/', { params: { path: { id } }, body: input }))

export const deactivateStaff = (id: number) =>
  unwrap(api.DELETE('/api/auth/users/{id}/', { params: { path: { id } } }))

export const setStaffPassword = (id: number, newPassword: string) =>
  unwrap(
    api.POST('/api/auth/users/{id}/set-password/', {
      params: { path: { id } },
      body: { new_password: newPassword },
    }),
  )
