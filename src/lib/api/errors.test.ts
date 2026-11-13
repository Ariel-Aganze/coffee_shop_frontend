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

  it('turns nested errors into dotted field paths', () => {
    const parsed = parseErrorBody({
      items: [{}, { quantity: ['Must be positive.'] }],
      owner: { username: ['This username is already taken.'] },
    })
    expect(parsed.fieldErrors).toEqual({
      'items.1.quantity': ['Must be positive.'],
      'owner.username': ['This username is already taken.'],
    })
    expect(parsed.message).toBe('Must be positive.')
  })

  it('handles list bodies raised by ValidationError(["…"])', () => {
    expect(parseErrorBody(['Insufficient stock.']).message).toBe('Insufficient stock.')
  })
})

describe("parseErrorBody with the API's error envelope", () => {
  it('uses the message for permission / not-found errors', () => {
    expect(parseErrorBody({ error: 'Not found.', details: {} })).toEqual({
      message: 'Not found.',
      fieldErrors: {},
    })
  })

  it('maps validation details to fields, summarising with the first real message', () => {
    const parsed = parseErrorBody({
      error: 'Validation error',
      details: { old_password: ['Current password is incorrect.'] },
    })
    expect(parsed.fieldErrors).toEqual({ old_password: ['Current password is incorrect.'] })
    expect(parsed.message).toBe('Current password is incorrect.') // never "Validation error"
  })

  it('prefers form-level messages in the envelope', () => {
    const parsed = parseErrorBody({
      error: 'Validation error',
      details: { non_field_errors: ['Pick a branch first.'], branch: ['Required.'] },
    })
    expect(parsed.message).toBe('Pick a branch first.')
    expect(parsed.fieldErrors).toEqual({ branch: ['Required.'] })
  })

  it('handles list details and plain business errors', () => {
    expect(
      parseErrorBody({ error: 'Validation error', details: ['Insufficient stock.'] }).message,
    ).toBe('Insufficient stock.')
    expect(parseErrorBody({ error: 'Invalid credentials.' }).message).toBe('Invalid credentials.')
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
