import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SetupCheck } from './SetupCheck'

function mockFetch(response: Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockReturnValue(response)
}

describe('SetupCheck', () => {
  it('reports the API as connected when /api/health/ answers ok', async () => {
    const fetchSpy = mockFetch(Promise.resolve(Response.json({ status: 'ok' })))
    render(<SetupCheck />)
    expect(await screen.findByText('Connected')).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledWith('/api/health/', expect.anything())
  })

  it('reports the API as unreachable and explains how to start it', async () => {
    mockFetch(Promise.reject(new TypeError('Failed to fetch')))
    render(<SetupCheck />)
    expect(await screen.findByText('Not reachable')).toBeInTheDocument()
    expect(screen.getByText(/manage\.py runserver/)).toBeInTheDocument()
  })

  it('shows the brand logo', () => {
    mockFetch(new Promise(() => {}))
    render(<SetupCheck />)
    expect(screen.getByRole('img', { name: 'Caffio' })).toBeInTheDocument()
  })
})
