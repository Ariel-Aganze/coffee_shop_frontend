import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'

import '@/i18n'
import { PageLoader } from '@/components/feedback/Loader'
import { AuthProvider } from '@/features/auth/AuthProvider'

import { createQueryClient } from './queryClient'
import { routes } from './routes'

// Query inspector in development only (not shipped in production builds).
const QueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
    )
  : () => null

const router = createBrowserRouter(routes)

export function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <RouterProvider router={router} />
        </Suspense>
      </AuthProvider>
      <Toaster
        position="top-right"
        closeButton
        toastOptions={{
          classNames: {
            toast: 'rounded-card! border-border! shadow-pop! font-sans!',
            title: 'text-ink!',
            description: 'text-ink-muted!',
          },
        }}
      />
      <Suspense>
        <QueryDevtools buttonPosition="bottom-right" />
      </Suspense>
    </QueryClientProvider>
  )
}
