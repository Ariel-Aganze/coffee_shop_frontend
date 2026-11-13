import type { QueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/lib/api/client'
import type { operations, Schema } from '@/lib/api/types'

export type Product = Schema<'Product'>
export type ProductType = Schema<'ProductTypeEnum'>
export type ProductPrice = Schema<'ProductPrice'>
export type Category = Schema<'Category'>
export type BranchAvailability = Schema<'ProductBranchAvailability'>
export type ProductListParams = NonNullable<operations['products_list']['parameters']['query']>
export type CategoryListParams = NonNullable<operations['categories_list']['parameters']['query']>
export type ProductCreateInput = Schema<'ProductCreateRequest'>
export type ProductUpdateInput = Schema<'PatchedProductUpdateRequest'>
export type PriceInput = Schema<'ProductPriceCreateRequest'>

export const PRODUCT_TYPES = ['drink', 'food', 'packaged'] as const satisfies readonly ProductType[]

export const productKeys = {
  all: ['products'] as const,
  list: (params: ProductListParams) => ['products', 'list', params] as const,
  detail: (id: number) => ['products', 'detail', id] as const,
  prices: (id: number) => ['products', 'detail', id, 'prices'] as const,
  availability: (id: number) => ['products', 'detail', id, 'availability'] as const,
}

export const categoryKeys = {
  all: ['categories'] as const,
  list: (params: CategoryListParams) => ['categories', 'list', params] as const,
  options: ['categories', 'options'] as const,
}

// ---------- Products ----------

export const fetchProductPage = (params: ProductListParams) =>
  unwrap(api.GET('/api/products/', { params: { query: params } }))

export const fetchProduct = (id: number) =>
  unwrap(api.GET('/api/products/{id}/', { params: { path: { id } } }))

/** Multipart when a photo is attached (the browser sets the boundary), JSON otherwise. */
export function withImage<T extends Record<string, unknown>>(
  input: T,
  image: File | null | undefined,
) {
  if (!image) return input
  const form = new FormData()
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue
    form.append(key, String(value))
  }
  form.append('image', image)
  return form as unknown as T
}

export const createProduct = (input: ProductCreateInput, image?: File | null) =>
  unwrap(api.POST('/api/products/', { body: withImage(input, image) }))

export const updateProduct = (id: number, input: ProductUpdateInput, image?: File | null) =>
  unwrap(
    api.PATCH('/api/products/{id}/', {
      params: { path: { id } },
      body: withImage(input, image),
    }),
  )

export const deactivateProduct = (id: number) =>
  unwrap(api.DELETE('/api/products/{id}/', { params: { path: { id } } }))

export const fetchPrices = (id: number) =>
  unwrap(api.GET('/api/products/{id}/prices/', { params: { path: { id } } }))

export const createPrice = (id: number, input: PriceInput) =>
  unwrap(api.POST('/api/products/{id}/prices/', { params: { path: { id } }, body: input }))

export const fetchAvailability = (id: number) =>
  unwrap(api.GET('/api/products/{id}/availability/', { params: { path: { id } } }))

export const setAvailability = (id: number, branch: number, isAvailable: boolean) =>
  unwrap(
    api.PUT('/api/products/{id}/availability/', {
      params: { path: { id } },
      body: { branches: [{ branch, is_available: isAvailable }] },
    }),
  )

// ---------- Categories ----------

export const fetchCategoryPage = (params: CategoryListParams) =>
  unwrap(api.GET('/api/categories/', { params: { query: params } }))

/**
 * Every category (active and not) for filters and pickers. Businesses have a
 * handful; 100 is the API's page-size ceiling.
 */
export const fetchCategoryOptions = async () =>
  (await fetchCategoryPage({ page_size: 100 })).results

export const createCategory = (input: Schema<'CategoryRequest'>) =>
  unwrap(api.POST('/api/categories/', { body: input }))

export const updateCategory = (id: number, input: Schema<'PatchedCategoryRequest'>) =>
  unwrap(api.PATCH('/api/categories/{id}/', { params: { path: { id } }, body: input }))

export const deactivateCategory = (id: number) =>
  unwrap(api.DELETE('/api/categories/{id}/', { params: { path: { id } } }))

/** Category changes rename/hide things shown on products too. */
export function invalidateCatalog(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: categoryKeys.all })
  void queryClient.invalidateQueries({ queryKey: productKeys.all })
}
