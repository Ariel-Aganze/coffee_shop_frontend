import { z } from 'zod'

import { checkPassword, passwordIsAcceptable } from '@/features/auth/passwordRules'
import {
  DATE_FORMATS,
  LANGUAGES,
  NUMBER_FORMATS,
  type DateFormat,
  type Language,
  type NumberFormat,
} from '@/features/settings/regional'

const optionalEmail = z.union([z.literal(''), z.email('onboarding.emailInvalid')])
const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+\d\s().-]*$/, 'profile.phoneInvalid')

/** One form for the whole wizard; field names match the API's nested paths. */
export const registrationSchema = z
  .object({
    business: z.object({
      name: z.string().trim().min(1, 'onboarding.required').max(255),
      contact_email: optionalEmail,
      contact_phone: phone,
      address: z.string().trim().max(500),
    }),
    owner: z.object({
      first_name: z.string().trim().max(150),
      last_name: z.string().trim().max(150),
      username: z
        .string()
        .trim()
        .min(1, 'onboarding.required')
        .max(150)
        .regex(/^[\w.@+-]+$/, 'onboarding.usernameInvalid'),
      email: z.email('onboarding.emailInvalid'),
      password: z.string(),
      confirm: z.string(),
    }),
    settings: z.object({
      currency_code: z.string().min(1, 'onboarding.currencyRequired'),
      language: z.enum(LANGUAGES.map((l) => l.value) as [Language, ...Language[]]),
      timezone: z.string().min(1),
      date_format: z.enum(DATE_FORMATS as [DateFormat, ...DateFormat[]]),
      number_format: z.enum(NUMBER_FORMATS as [NumberFormat, ...NumberFormat[]]),
    }),
    first_branch: z.object({
      name: z.string().trim().min(1, 'onboarding.required').max(255),
      address: z.string().trim().max(500),
      phone,
    }),
  })
  .superRefine((values, ctx) => {
    const { owner } = values
    const rules = checkPassword(owner.password, {
      personal: [owner.username, owner.first_name, owner.last_name, owner.email],
    })
    if (!passwordIsAcceptable(rules)) {
      ctx.addIssue({ code: 'custom', path: ['owner', 'password'], message: 'password.newInvalid' })
    }
    if (owner.password !== owner.confirm) {
      ctx.addIssue({ code: 'custom', path: ['owner', 'confirm'], message: 'password.mismatch' })
    }
  })

export type RegistrationForm = z.infer<typeof registrationSchema>

export const STEPS = [
  {
    key: 'business',
    fields: [
      'business.name',
      'business.contact_email',
      'business.contact_phone',
      'business.address',
    ],
  },
  {
    key: 'owner',
    fields: [
      'owner.first_name',
      'owner.last_name',
      'owner.username',
      'owner.email',
      'owner.password',
      'owner.confirm',
    ],
  },
  {
    key: 'region',
    fields: [
      'settings.currency_code',
      'settings.language',
      'settings.timezone',
      'settings.date_format',
      'settings.number_format',
    ],
  },
  { key: 'branch', fields: ['first_branch.name', 'first_branch.address', 'first_branch.phone'] },
  { key: 'review', fields: [] },
] as const satisfies readonly { key: string; fields: readonly string[] }[]

export type StepKey = (typeof STEPS)[number]['key']
export const ALL_FIELDS = STEPS.flatMap((s) => s.fields)
