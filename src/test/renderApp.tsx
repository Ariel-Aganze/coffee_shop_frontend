import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'

import '@/i18n'
import { createQueryClient } from '@/app/queryClient'
import { routes } from '@/app/routes'
import { AuthProvider } from '@/features/auth/AuthProvider'

/** Render the real app (routes, auth, providers) at `path`, in memory. */
export function renderApp(path = '/') {
  const queryClient = createQueryClient()
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const user = userEvent.setup()
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  )
  return { ...utils, router, user, queryClient }
}
