# Caffio — frontend

Web app for **Caffio**, a multi-branch coffee shop management system: point of sale,
inventory, cash sessions, expenses, reports and an owner dashboard. It talks to the Django
REST API in [`coffee_shop_backend`](../coffee_shop_backend).

**Stack:** React 19 · TypeScript 7 · Vite 8 · Tailwind CSS 4 · Vitest · oxlint · Prettier

## Requirements

- Node.js **24** (see `.nvmrc`; ≥ 22.12 works) and npm 11
- The backend running locally for live data (`venv/bin/python manage.py runserver`)

## Getting started

```bash
npm install
cp .env.example .env.local   # then adjust if needed
npm run dev                  # http://localhost:5173
```

In development the browser only talks to Vite: requests to `/api` and `/media` are proxied
to Django (`API_PROXY_TARGET`, default `http://localhost:8000`). No CORS setup is needed
and the app uses the same relative URLs as in production.

Demo data and logins: run `venv/bin/python manage.py seed_demo` in the backend (password
for every demo user: `Demo1234!`, e.g. `demo_owner`, `demo_cashier1a`).

## Scripts

| Command             | What it does                                                    |
| ------------------- | --------------------------------------------------------------- |
| `npm run dev`       | Dev server with hot reload                                      |
| `npm run build`     | Type-check, then production build into `dist/`                  |
| `npm run preview`   | Serve the production build locally                              |
| `npm run typecheck` | TypeScript only                                                 |
| `npm run lint`      | oxlint (fails on warnings)                                      |
| `npm run format`    | Prettier (also sorts Tailwind classes)                          |
| `npm run test`      | Unit/component tests (Vitest + Testing Library)                 |
| `npm run check`     | typecheck + lint + format check + tests — run before committing |
| `npm run api:types` | Regenerate API types from the backend's OpenAPI schema          |

## Environment variables

Documented in [`.env.example`](.env.example). Variables prefixed with `VITE_` end up in
the browser bundle — they are public; never put secrets in them. They are validated at
startup by [`src/config/env.ts`](src/config/env.ts); read them through `env`, not
`import.meta.env`.

## API types

`src/lib/api/schema.d.ts` is **generated** from the backend's OpenAPI schema and committed,
so the app builds without the backend running. After any backend API change:

```bash
npm run api:types                      # from the running backend (API_SCHEMA_URL)
npm run api:types -- path/to/schema.yml  # or from a saved schema file
```

Use the aliases in [`src/lib/api/types.ts`](src/lib/api/types.ts):
`Schema<'SaleRead'>` for responses, `Schema<'SaleCreateRequest'>` for request bodies.
Never edit `schema.d.ts` by hand.

## Project structure

```
src/
  app/            App shell: root component, providers, router
  assets/brand/   Logo and loader animation (optimised WebP)
  components/     Shared, feature-agnostic UI
    brand/        Logo
    feedback/     Loader, (later) toasts, empty and error states
    ui/           Buttons, inputs, tables, pagination… (added as features need them)
    layout/       Sidebar, header, page containers
  config/         Validated environment config
  features/       One folder per business area: auth, dashboard, pos, products,
                  inventory, expenses, cash, reports, settings, staff…
                  each with its own api.ts, components/, pages/ and hooks
  lib/            Framework-agnostic helpers (api client & types, cn, formatting)
  styles/         Tailwind entry point and design tokens
  test/           Test setup
```

Import with the `@/` alias (`@/components/brand/Logo`), not long relative paths.

## How the app is wired

| Concern          | Where                                     | Notes                                                                                                        |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| API calls        | `src/lib/api/client.ts`                   | `unwrap(api.GET('/api/…', { params }))` — fully typed; throws `ApiError`                                     |
| Errors           | `src/lib/api/errors.ts`                   | `ApiError.message` is safe to show; `fieldErrors` for forms                                                  |
| Session          | `src/lib/api/tokens.ts`, `session.ts`     | Access token in memory, refresh token in localStorage; automatic renewal on 401 (one at a time, across tabs) |
| Signed-in user   | `useAuth()` / `useCurrentUser()`          | `status`, `login`, `logout`, sign-out reason                                                                 |
| Role rules       | `src/features/auth/permissions.ts`        | `can(role, 'pos.use')` — mirrors the backend; UI only, the API enforces                                      |
| Routes & guards  | `src/app/routes.tsx`                      | Every page declares its title and permission; lazy-loaded                                                    |
| Business context | `useBusiness()`, `useFormat()`            | Settings, branches, selected branch (`branchId`, null = all)                                                 |
| Formatting       | `src/lib/format.ts`                       | Money from decimal strings, business timezone & formats                                                      |
| Server data      | TanStack Query                            | 4xx not retried; failed mutations toast unless `meta.silentError`                                            |
| Forms            | React Hook Form + Zod, `src/lib/forms.ts` | `applyServerErrors()` puts API validation messages on the fields; `fieldMessage()` translates                |
| Text             | `src/i18n/locales/en/common.json`         | Type-checked keys: `t('nav.dashboard')`                                                                      |
| Lists            | `usePaginationParams()` + `<Pagination>`  | `?page=&page_size=` in the URL                                                                               |

## Conventions

- **Design tokens.** Colours, radii and shadows live in `src/styles/index.css` (`@theme`).
  Use semantic classes — `bg-primary`, `text-ink-muted`, `border-border`, `bg-success-soft`
  — never raw hex values. Text/background pairs meet WCAG AA contrast.
- **Responsive by default.** Mobile-first Tailwind classes; every page must work from a
  360 px phone to a wide desktop without horizontal scrolling. The POS is designed for
  tablets first.
- **Lists are paginated** using the API's `?page=` / `?page_size=` (max 100); never load
  unbounded lists. The POS catalogue is the one deliberate exception (`/api/pos/catalog/`).
- **Accessibility.** Semantic HTML first, visible keyboard focus, labelled controls,
  `prefers-reduced-motion` respected.
- **Class names** are combined with `cn()` (`src/lib/cn.ts`) so conflicting Tailwind
  classes resolve predictably.
- **Money** is handled as decimal strings from the API and formatted with the business
  currency's precision — never with floating-point arithmetic.

## Notes

- `openapi-typescript` runs through `npx` with pinned versions instead of being a
  dependency: it needs the TypeScript 5 API, while the project compiles with TypeScript 7.
- The `fsevents` install script is denied (`allowScripts` in `package.json`); its prebuilt
  binary is used.
