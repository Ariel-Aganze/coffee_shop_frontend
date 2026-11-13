import { describe, expect, it } from 'vitest'

import { ApiError, getErrorMessage, parseErrorBody } from './errors'

describe('parseErrorBody', () => {
  it('reads DRF detail and this API’s error messages', () => {
    expect(parseErrorBody({ detail: 'Not found.' }).message).toBe('Not found.')
    expect(parseErrorBody({ error: 'Invalid credentials.' }).message).toBe('Invalid credentials.')
  })

  it('collects field errors and uses the form-level message first', () => {
    const parsed = parseErrorBody({
      username: ['This field is required.'],
      non_field_errors: ['Something about the whole form.'],
    })
    expect(parsed.fieldErrors).toEqual({ username: ['This field is required.'] })
    expect(parsed.message).toBe('Something about the whole form.')
  })

  it('flattens nested field errors', () => {
    const parsed = parseErrorBody({ items: [{ quantity: ['Must be positive.'] }] })
    expect(parsed.fieldErrors.items).toEqual(['Must be positive.'])
  })

  it('handles list bodies raised by ValidationError(["…"])', () => {
    expect(parseErrorBody(['Insufficient stock.']).message).toBe('Insufficient stock.')
  })
})

describe('ApiError', () => {
  it('falls back to a human message per status', () => {
    expect(new ApiError(403, null).message).toMatch(/permission/)
    expect(new ApiError(500, '<html>Server Error</html>').message).toMatch(/on our side/)
    expect(new ApiError(502, null).message).toMatch(/on our side/)
    expect(new ApiError(0, null).isNetworkError).toBe(true)
  })

  it('getErrorMessage works for any thrown value', () => {
    expect(getErrorMessage(new ApiError(400, { error: 'Nope.' }))).toBe('Nope.')
    expect(getErrorMessage(new Error('Boom'))).toBe('Boom')
    expect(getErrorMessage('weird')).toMatch(/Something went wrong/)
  })
})
