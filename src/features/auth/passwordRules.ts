/**
 * Live password checklist mirroring the backend's validators
 * (AUTH_PASSWORD_VALIDATORS). Guidance only: the server is the authority and
 * also rejects common passwords, which the browser can't know.
 */
export type PasswordRuleKey = 'length' | 'notNumeric' | 'notPersonal' | 'different'

export interface PasswordRuleResult {
  key: PasswordRuleKey
  met: boolean
}

export const MIN_PASSWORD_LENGTH = 8

interface Context {
  /** Username, names and email: the password shouldn't resemble them. */
  personal?: (string | undefined)[]
  /** Current password, when changing it. */
  current?: string
}

function resemblesPersonal(password: string, personal: (string | undefined)[]): boolean {
  const value = password.toLowerCase()
  return personal
    .flatMap((item) => (item ?? '').toLowerCase().split(/[@.\s_-]+/))
    .filter((part) => part.length >= 3)
    .some((part) => value.includes(part))
}

export function checkPassword(password: string, context: Context = {}): PasswordRuleResult[] {
  const rules: PasswordRuleResult[] = [
    { key: 'length', met: password.length >= MIN_PASSWORD_LENGTH },
    { key: 'notNumeric', met: password.length > 0 && !/^\d+$/.test(password) },
  ]
  if (context.personal) {
    rules.push({
      key: 'notPersonal',
      met: password.length > 0 && !resemblesPersonal(password, context.personal),
    })
  }
  if (context.current !== undefined) {
    rules.push({ key: 'different', met: password.length > 0 && password !== context.current })
  }
  return rules
}

export const passwordIsAcceptable = (results: PasswordRuleResult[]) => results.every((r) => r.met)
