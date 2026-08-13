# FarmaTeAcerca API

NestJS backend for the FarmaTeAcerca thesis project (Analista de Sistemas). Implements the
functional analysis approved by the thesis director for `farma-te-acerca` (the frontend, a
separate repo): relocation requests submitted by store employees, Capital Humano's screen to
review them by desired branch plus analytics/reportería, and DT (branch manager) lookup of nearby
employees for contingencies. See `DEVIATIONS.md` for every place this implementation diverges from
the approved PDF and why.

Stack: **NestJS** + **Prisma** (against Supabase Postgres, via `@prisma/adapter-pg` — Prisma 7
requires an explicit driver adapter) + **Supabase Auth** for identity (see `DEVIATIONS.md` §1).

## Setup

### 1. Create the Supabase project

1. [supabase.com](https://supabase.com) → New project (free tier is enough for this scope).
2. **Project Settings → Database → Connection string**: copy the pooled connection string (port
   `6543`, `?pgbouncer=true`) into `DATABASE_URL`, and the direct one (port `5432`) into
   `DIRECT_URL`.
3. **Project Settings → API**: copy `Project URL` → `SUPABASE_URL`, `anon` key →
   `SUPABASE_ANON_KEY`, `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never
   ship this to the frontend).
4. **Authentication → Email Templates → Reset password**: switch it to include `{{ .Token }}`
   (a numeric code, observed as 8 digits) rather than the default magic-link
   `{{ .ConfirmationURL }}` — the frontend's "¿Olvidaste tu contraseña?" dialog is a 3-step
   email → code → new-password wizard, which needs the code, not a link.
5. **Authentication → Providers → Azure**: needed for the "SSO con usuario de 365" requirement.
   Requires a real Azure AD app registration/tenant from Farmacity — see `DEVIATIONS.md` §7; skip
   this step until those credentials exist, the rest of the API works without it.

Copy `.env.example` to `.env` and fill in the values above.

### 2. Install, migrate, seed

```bash
yarn install
yarn prisma migrate dev   # applies prisma/schema.prisma, uses DIRECT_URL
yarn prisma db seed       # sucursales + a handful of demo colaboradores (see below)
```

`prisma/seed.ts` seeds the 8 sucursales the frontend already ships in `mockData.ts`, with
approximate manually-sourced lat/lng (see `DEVIATIONS.md` §4), plus 5 demo colaboradores (one per
role, plus two extra collaborators at other branches so the DT/HC screens have something to show)
— all with password `Demo1234!`. The `collaborator`-role demo accounts also get a `Domicilio` (home
lat/lng) so `GET /dt/nearby-employees` has real distances to demo. This is dev/demo-only
convenience, not part of the approved functional spec (real colaboradores come from Farmacity's HR
system feed, which is out of scope for this project).

### 3. Run

```bash
yarn start:dev   # http://localhost:3000, Swagger docs at /docs
```

## Commands

```bash
yarn build       # tsc build
yarn start:dev   # watch mode
yarn lint        # eslint --fix
yarn test        # unit tests
yarn test:e2e    # e2e tests
yarn prisma studio   # browse the DB
```

## Notes for whoever wires up the frontend next

- Every response shape is designed to match the frontend's existing `src/types/index.ts` /
  `src/data/mockData.ts` field names exactly (see each module's `// Shape matches...` comments),
  so swapping `mockData.ts` calls for real `fetch`s should be close to a drop-in replacement.
  Auth is the one exception — `AuthContext.login(user, role)` needs its signature to change, since
  today the frontend lets the caller pick the role client-side; the real contract is
  `POST /auth/login` returning the role resolved server-side. See `DEVIATIONS.md` for the couple of
  open questions worth resolving before that integration pass (initial solicitud estado, the
  mailto: reading of "Contactar"/"Solicitar cobertura").
- `RequestStatus` values are stored as a Postgres enum with JS-side member names (`EnCurso`) that
  don't match the Spanish labels the frontend expects (`"En curso"`) — always go through
  `toStatusLabel`/`fromStatusLabel` (`src/common/status.util.ts`) at the API boundary, never
  serialize the raw enum.
