import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Loader } from './Loader'

describe('Loader', () => {
  it('announces its label to assistive technology', () => {
    render(<Loader label="Loading sales…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading sales…')
  })

  it('offers a still frame for users who prefer reduced motion', () => {
    const { container } = render(<Loader />)
    const source = container.querySelector('source')
    expect(source).toHaveAttribute('media', '(prefers-reduced-motion: reduce)')
    // The animation itself is decorative.
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })
})
