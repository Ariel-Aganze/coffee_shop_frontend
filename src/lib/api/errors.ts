/**
 * One error type for every failed API call, with a message that is safe and
 * useful to show to people, plus per-field messages for forms.
 *
 * Django REST Framework error bodies come in a few shapes:
 *   { "detail": "…" }                     permission / not found / auth
 *   { "error": "…" }                      this API's own business errors
 *   { "field": ["msg", …], … }            validation errors per field
 *   { "non_field_errors": ["msg"] }       validation errors for the whole form
 *   ["msg", …]                            ValidationError raised with a list
 */
export type FieldErrors = Record<string, string[]>

const STATUS_MESSAGES: Record<number, string> = {
  0: "Can't reach the server. Check your connection and try again.",
  400: 'Please check the highlighted information.',
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: 'This was changed by someone else. Refresh and try again.',
  429: 'Too many attempts. Please wait a moment and try again.',
}
const SERVER_ERROR = 'Something went wrong on our side. Please try again.'

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldErrors
  readonly body: unknown

  constructor(status: number, body: unknown, options?: { message?: string; cause?: unknown }) {
    // A 5xx with a text body is usually an HTML error page: never show it.
    const parsed = parseErrorBody(status >= 500 && typeof body === 'string' ? null : body)
    super(options?.message ?? parsed.message ?? defaultMessage(status), {
      cause: options?.cause,
    })
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = parsed.fieldErrors
    this.body = body
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }
}

function defaultMessage(status: number): string {
  return STATUS_MESSAGES[status] ?? (status >= 500 ? SERVER_ERROR : 'Request failed.')
}

function asMessages(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(asMessages)
  if (value && typeof value === 'object') return Object.values(value).flatMap(asMessages)
  return []
}

export function parseErrorBody(body: unknown): { message?: string; fieldErrors: FieldErrors } {
  if (typeof body === 'string' && body.trim()) return { message: body, fieldErrors: {} }
  if (Array.isArray(body)) return { message: asMessages(body)[0], fieldErrors: {} }
  if (!body || typeof body !== 'object') return { fieldErrors: {} }

  const record = body as Record<string, unknown>
  for (const key of ['detail', 'error'] as const) {
    const [first] = asMessages(record[key])
    if (first) return { message: first, fieldErrors: {} }
  }

  const fieldErrors: FieldErrors = {}
  for (const [field, value] of Object.entries(record)) {
    if (field === 'non_field_errors') continue
    const messages = asMessages(value)
    if (messages.length) fieldErrors[field] = messages
  }
  const [formLevel] = asMessages(record.non_field_errors)
  const [firstField] = Object.values(fieldErrors)
  return { message: formLevel ?? firstField?.[0], fieldErrors }
}

/** A message for any thrown value — use in toasts and error banners. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return SERVER_ERROR
}
