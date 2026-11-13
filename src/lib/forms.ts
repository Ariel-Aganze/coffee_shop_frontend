import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { i18n } from '@/i18n'

import { ApiError, getErrorMessage } from './api/errors'

/**
 * Show a failed request's validation messages on the matching form fields.
 *
 *   const banner = applyServerErrors(error, setError, { old_password: 'currentPassword' })
 *
 * `fieldMap` maps API field names to form field names when they differ;
 * fields with the same name map automatically. Returns the message to show
 * in the form's banner — or null when every problem is shown on a field.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldMap: Partial<Record<string, Path<T>>> = {},
  formFields: readonly Path<T>[] = [],
): string | null {
  if (!(error instanceof ApiError)) return getErrorMessage(error)

  let unmatched = false
  let placed = false
  for (const [apiField, messages] of Object.entries(error.fieldErrors)) {
    const field =
      fieldMap[apiField] ??
      (formFields.includes(apiField as Path<T>) ? (apiField as Path<T>) : undefined)
    if (field) {
      setError(field, { type: 'server', message: messages.join(' ') }, { shouldFocus: !placed })
      placed = true
    } else {
      unmatched = true
    }
  }
  if (placed && !unmatched) return null
  return error.message
}

/**
 * Message for a form field: validation messages defined in the app are
 * translation keys; messages from the server are already readable text.
 */
export function fieldMessage(
  t: (key: never) => string,
  message: string | undefined,
): string | undefined {
  if (!message) return undefined
  return i18n.exists(message) ? t(message as never) : message
}
