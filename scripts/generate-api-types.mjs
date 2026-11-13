#!/usr/bin/env node
/**
 * Generate TypeScript types for the Django API from its OpenAPI schema.
 *
 *   npm run api:types                       # from API_SCHEMA_URL (backend running)
 *   npm run api:types -- ./schema.yml       # from a saved schema file
 *
 * Output: src/lib/api/schema.d.ts (committed, so the app builds without the
 * backend running). Re-run whenever the backend API changes.
 *
 * Why npx with pinned versions: openapi-typescript is built on the
 * TypeScript 5 JS API, while this project compiles with TypeScript 7. Running
 * the generator from npm's cache with its own TypeScript keeps the two apart
 * and stays reproducible.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const GENERATOR = 'openapi-typescript@7.13.0'
const GENERATOR_TS = 'typescript@5.9.3'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'src/lib/api/schema.d.ts')
const source = process.argv[2] ?? process.env.API_SCHEMA_URL ?? 'http://localhost:8000/api/schema/'

const isUrl = /^https?:\/\//.test(source)
if (!isUrl && !existsSync(source)) {
  console.error(`Schema file not found: ${source}`)
  process.exit(1)
}

mkdirSync(dirname(output), { recursive: true })
console.warn(`Generating API types from ${source}`)

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(
  npx,
  [
    '--yes',
    '-p',
    GENERATOR,
    '-p',
    GENERATOR_TS,
    'openapi-typescript',
    source,
    '--output',
    output,
    '--alphabetize',
    // Request fields that have a server-side default are optional to send.
    // (Response fields are all marked required by the backend's schema hook.)
    '--default-non-nullable=false',
  ],
  { stdio: 'inherit', cwd: root, shell: process.platform === 'win32' },
)

if (result.status !== 0) {
  console.error(
    isUrl
      ? '\nCould not generate types. Is the backend running? (venv/bin/python manage.py runserver)'
      : '\nCould not generate types from the schema file.',
  )
  process.exit(result.status ?? 1)
}
console.warn(`Wrote ${output}`)
