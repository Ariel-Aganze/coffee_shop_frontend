import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import '@/i18n'
import { usePaginationParams } from '@/hooks/usePaginationParams'

import { Pagination } from './Pagination'
import { pageWindow } from './pageWindow'

describe('pageWindow', () => {
  it('lists every page when there are few', () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5])
  })
  it('keeps first, last and neighbours with gaps', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, null, 20])
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20])
    expect(pageWindow(20, 20)).toEqual([1, null, 19, 20])
  })
})

describe('<Pagination>', () => {
  it('summarises the range and marks the current page', () => {
    render(<Pagination page={3} pageSize={20} count={132} onPageChange={() => {}} />)
    expect(screen.getByText('Showing 41–60 of 132')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go to page 3' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByText('Page 3 of 7')).toBeInTheDocument() // compact phone label
  })

  it('moves between pages and disables the ends', async () => {
    const onPageChange = vi.fn<(page: number) => void>()
    render(<Pagination page={1} pageSize={20} count={45} onPageChange={onPageChange} />)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await userEvent.click(screen.getByRole('button', { name: 'Go to page 3' }))
    expect(onPageChange.mock.calls).toEqual([[2], [3]])
  })

  it('hides page controls when everything fits and handles no results', () => {
    const { rerender } = render(
      <Pagination page={1} pageSize={20} count={5} onPageChange={() => {}} />,
    )
    expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument()
    rerender(<Pagination page={1} pageSize={20} count={0} onPageChange={() => {}} />)
    expect(screen.getByText('No results')).toBeInTheDocument()
  })

  it('lets people change the page size', async () => {
    const onPageSizeChange = vi.fn<(size: number) => void>()
    render(
      <Pagination
        page={1}
        pageSize={20}
        count={500}
        onPageChange={() => {}}
        onPageSizeChange={onPageSizeChange}
      />,
    )
    await userEvent.selectOptions(screen.getByLabelText('Rows per page'), '50')
    expect(onPageSizeChange).toHaveBeenCalledWith(50)
  })
})

/** Run the hook inside a router at `url`; expose its value and the URL query. */
function setup(url: string) {
  const result: { current: ReturnType<typeof usePaginationParams> | null } = { current: null }
  let search = ''
  function Host() {
    result.current = usePaginationParams()
    search = useLocation().search
    return null
  }
  const router = createMemoryRouter([{ path: '/', element: <Host /> }], { initialEntries: [url] })
  render(<RouterProvider router={router} />)
  return { result, location: () => search }
}

describe('usePaginationParams', () => {
  it('reads page and size from the URL with safe defaults', () => {
    expect(setup('/').result.current).toMatchObject({ page: 1, pageSize: 20 })
    expect(setup('/?page=3&page_size=50').result.current?.apiParams).toEqual({
      page: 3,
      page_size: 50,
    })
    expect(setup('/?page=-2&page_size=abc').result.current).toMatchObject({ page: 1, pageSize: 20 })
    expect(setup('/?page_size=5000').result.current?.pageSize).toBe(100) // API maximum
  })

  it('writes changes to the URL; a new size starts from page 1', () => {
    const { result, location } = setup('/?page=4&status=open')
    act(() => result.current?.setPageSize(50))
    expect(location()).toBe('?status=open&page_size=50')
    act(() => result.current?.setPage(2))
    expect(location()).toBe('?status=open&page_size=50&page=2')
    act(() => result.current?.setPage(1))
    expect(location()).toBe('?status=open&page_size=50')
  })
})
