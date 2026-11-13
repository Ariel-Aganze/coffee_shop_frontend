import { MutationCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { ApiError, getErrorMessage } from '@/lib/api/errors'

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError
    mutationMeta: {
      /** Set when the screen shows the error itself (e.g. form field errors). */
      silentError?: boolean
      /** Toast shown when the mutation succeeds. */
      successMessage?: string
    }
  }
}

function shouldRetry(failureCount: number, error: unknown): boolean {
  // Client errors (bad input, no permission, not found…) won't fix themselves.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return failureCount < 2
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false, // never repeat a write automatically (duplicate sales!)
      },
    },
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        if (mutation.meta?.silentError) return
        if (error instanceof ApiError && error.status === 401) return // handled by sign-out
        toast.error(getErrorMessage(error))
      },
      onSuccess: (_data, _vars, _ctx, mutation) => {
        if (mutation.meta?.successMessage) toast.success(mutation.meta.successMessage)
      },
    }),
  })
}
