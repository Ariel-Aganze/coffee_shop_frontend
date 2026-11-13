/**
 * Friendly aliases over the generated API types (./schema.d.ts).
 *
 * Regenerate the schema with `npm run api:types` whenever the backend changes;
 * never edit schema.d.ts by hand.
 *
 *   import type { Schema } from '@/lib/api/types'
 *   type Sale = Schema<'SaleRead'>
 *   type NewSale = Schema<'SaleCreateRequest'>
 */
import type { components, operations, paths } from './schema'

export type { components, operations, paths }

/** A named schema component, e.g. Schema<'Product'> or Schema<'ProductRequest'>. */
export type Schema<Name extends keyof components['schemas']> = components['schemas'][Name]

/** DRF page-number pagination envelope used by every list endpoint. */
export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
