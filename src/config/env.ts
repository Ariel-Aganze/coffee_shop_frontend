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
    .transform((v) => v.replace(/\/+$/, ''))
    .refine((v) => v.startsWith('/') || /^https?:\/\//.test(v), {
      message: 'must be a path like /api or an absolute http(s) URL',
    })
    .refine((v) => v.endsWith('/api'), {
      message: 'must end with /api (API paths are /api/…)',
    }),
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

/**
 * Server origin for the typed API client: the generated API paths already
 * start with /api, so '/api' → '' (same origin) and
 * 'https://api.example.com/api' → 'https://api.example.com'.
 */
export function apiOriginFrom(apiBaseUrl: string): string {
  return apiBaseUrl.slice(0, -'/api'.length)
}

export const env = parseEnv({
  VITE_API_BASE_URL: '/api', // default when not set
  ...import.meta.env,
})

/**
 * Absolute server origin for API requests. A same-origin deployment ('/api')
 * resolves against the page's own origin, because `Request` objects need
 * absolute URLs outside the browser (e.g. in tests).
 */
export const apiOrigin = apiOriginFrom(env.VITE_API_BASE_URL) || (globalThis.location?.origin ?? '')

/** Absolute URL for an API path such as '/api/auth/token/refresh/'. */
export function apiUrl(path: `/api/${string}`): string {
  return `${apiOrigin}${path}`
}
