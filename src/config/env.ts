import { z } from 'zod'

/**
 * Typed, validated access to build-time environment variables.
 * Import `env` instead of reading `import.meta.env` directly, so a missing or
 * malformed value fails loudly at startup instead of deep inside a request.
 */
const schema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith('/') || /^https?:\/\//.test(v), {
      message: 'must be a path like /api or an absolute http(s) URL',
    })
    .transform((v) => v.replace(/\/+$/, '')),
  VITE_APP_NAME: z.string().min(1).default('Caffio'),
  MODE: z.string(),
  DEV: z.boolean(),
  PROD: z.boolean(),
})

export type Env = z.infer<typeof schema>

export function parseEnv(source: Record<string, unknown>): Env {
  const result = schema.safeParse(source)
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${problems}\nSee .env.example.`)
  }
  return result.data
}

export const env = parseEnv({
  VITE_API_BASE_URL: '/api', // default when not set
  ...import.meta.env,
})
