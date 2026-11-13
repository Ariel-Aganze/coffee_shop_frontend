import type { QueryClient } from '@tanstack/react-query'

import type { CurrentUser } from '@/features/auth/api'
import { api, unwrap } from '@/lib/api/client'
import type { operations, Schema } from '@/lib/api/types'

export type Expense = Schema<'Expense'>
export type ExpenseStatus = Expense['status']
export type ExpenseCategory = Schema<'ExpenseCategory'>
export type ExpenseListParams = NonNullable<operations['expenses_list']['parameters']['query']>
export type ExpenseCategoryListParams = NonNullable<
  operations['expense_categories_list']['parameters']['query']
>
export type ExpenseSummary = Schema<'ExpenseSummary'>

export interface ExpenseInput {
  category: number
  amount: string
  description: string
  branch: number | null
  expense_date: string
}

export const expenseKeys = {
  all: ['expenses'] as const,
  list: (params: ExpenseListParams) => ['expenses', 'list', params] as const,
  summary: (params: ExpenseListParams) => ['expenses', 'summary', params] as const,
  detail: (id: number) => ['expenses', 'detail', id] as const,
  categories: (params: ExpenseCategoryListParams) => ['expenses', 'categories', params] as const,
  categoryOptions: ['expenses', 'categories', 'options'] as const,
}

export const fetchExpensePage = (params: ExpenseListParams) =>
  unwrap(api.GET('/api/expenses/', { params: { query: params } }))

export const fetchExpenseSummary = (params: ExpenseListParams) => {
  const { page: _page, page_size: _size, ...filters } = params
  return unwrap(api.GET('/api/expenses/summary/', { params: { query: filters } }))
}

export const fetchExpense = (id: number) =>
  unwrap(api.GET('/api/expenses/{id}/', { params: { path: { id } } }))

/** JSON, or multipart when a receipt file is attached (the browser sets the boundary). */
function body(input: Partial<ExpenseInput> & { attachment?: File | null }) {
  const { attachment, ...rest } = input
  if (!attachment) return attachment === null ? { ...rest, attachment: null } : rest
  const form = new FormData()
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined && value !== null) form.append(key, String(value))
  }
  form.append('attachment', attachment)
  return form
}

export const createExpense = (input: ExpenseInput & { attachment?: File | null }) =>
  unwrap(
    api.POST('/api/expenses/', {
      body: body(input) as unknown as Schema<'ExpenseCreateRequest'>,
    }),
  )

export const updateExpense = (
  id: number,
  input: Partial<ExpenseInput> & { attachment?: File | null },
) =>
  unwrap(
    api.PATCH('/api/expenses/{id}/', {
      params: { path: { id } },
      body: body(input) as unknown as Schema<'PatchedExpenseUpdateRequest'>,
    }),
  )

export const approveExpense = (id: number, note: string) =>
  unwrap(api.POST('/api/expenses/{id}/approve/', { params: { path: { id } }, body: { note } }))

export const rejectExpense = (id: number, note: string) =>
  unwrap(api.POST('/api/expenses/{id}/reject/', { params: { path: { id } }, body: { note } }))

export const fetchCategoryPage = (params: ExpenseCategoryListParams) =>
  unwrap(api.GET('/api/expense-categories/', { params: { query: params } }))

export const fetchCategoryOptions = async () =>
  (await fetchCategoryPage({ page_size: 100 })).results

export const createCategory = (input: Schema<'ExpenseCategoryRequest'>) =>
  unwrap(api.POST('/api/expense-categories/', { body: input }))

export const updateCategory = (id: number, input: Schema<'PatchedExpenseCategoryRequest'>) =>
  unwrap(api.PATCH('/api/expense-categories/{id}/', { params: { path: { id } }, body: input }))

export const deactivateCategory = (id: number) =>
  unwrap(api.DELETE('/api/expense-categories/{id}/', { params: { path: { id } } }))

export function invalidateExpenses(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: expenseKeys.all })
}

/** Owners and unrestricted accountants file business-wide expenses; everyone else picks a branch. */
export function canFileCentral(user: Pick<CurrentUser, 'role' | 'branch_ids'>) {
  return user.role === 'owner' || (user.role === 'accountant' && user.branch_ids.length === 0)
}

/** May this user change this expense? Pending only, and only its author or the owner. */
export function canEdit(user: Pick<CurrentUser, 'id' | 'role'>, expense: Expense) {
  return expense.status === 'pending' && (expense.submitted_by === user.id || user.role === 'owner')
}

/** May this user approve or reject it? Owners and branch managers, never their own (owners excepted). */
export function canReview(user: Pick<CurrentUser, 'id' | 'role'>, expense: Expense) {
  if (expense.status !== 'pending') return false
  if (user.role === 'owner') return true
  return user.role === 'branch_manager' && expense.submitted_by !== user.id
}

export const ATTACHMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
