# Frontend integration guide

For the session working on `farma-te-acerca` (the frontend). Everything the API returns is shaped
to match `src/types/index.ts` / `src/data/mockData.ts` field-for-field wherever possible, so most
of this integration is "replace a mock array with a fetch call." The exceptions are called out
explicitly in §5 — read that before wiring buttons/forms, not after.

The API itself (`farma-te-acerca-api/`) is built, migrated, seeded, and smoke-tested against a live
Supabase project. `README.md` there has setup steps if the API isn't already running; `DEVIATIONS.md`
has the full rationale for every place this diverges from the approved PDF (referenced below by §).

## 1. Setup

- Run the API (`yarn start:dev` from `farma-te-acerca-api/`) — defaults to `http://localhost:3000`.
- Add `VITE_API_BASE_URL=http://localhost:3000` to the frontend's env (no such env var exists yet —
  this repo currently has zero API config, confirmed nothing references `VITE_`/`fetch`/`axios`).
- CORS on the API is already open to `http://localhost:5173` (Vite's default port) via its
  `CORS_ORIGIN` env var — update that on the API side if the frontend runs on a different port.
- Swagger UI at `http://localhost:3000/docs` — every endpoint below, live, with request/response
  schemas and a "try it out" button. Fastest way to sanity-check a shape while wiring a component.
- Demo accounts (all password `Demo1234!`) — see §7.

## 2. Auth — the one real breaking change

Today, `AuthContext.login(user, role)` (`src/context/AuthContext.tsx`) takes the role as a
caller-supplied parameter — the login form's role `<Select>` picks it, there's no server
round-trip at all. That can't survive integration: the role has to come back from the server.

**New flow:**

```
POST /auth/login
Body: { "legajo": "10001", "password": "Demo1234!" }

200 →
{
  "accessToken": "eyJ...",
  "refreshToken": "u57g67osx4sc",
  "expiresIn": 3600,
  "user": { "legajo": "10001", "fullName": "Colaborador Demo", "role": "collaborator", "email": "..." }
}

401 → { "message": "Usuario o contraseña incorrectos.", "error": "Unauthorized", "statusCode": 401 }
401 → { "message": "Usuario bloqueado por intentos fallidos. Restablecé tu contraseña para continuar." }
```

- `AuthContext.login` needs to become async and take `(legajo, password)`, call this endpoint, and
  derive `{ user: fullName, role }` from the response — drop the role `<Select>` from `LoginPage`
  entirely, it's server-resolved now.
- The lockout-after-5-attempts logic currently faked client-side in `LoginPage.tsx` (`attempts`
  state, `MAX_ATTEMPTS`) can be deleted — the backend now owns that (`Profile.failedAttempts`,
  DEVIATIONS.md §1). Just surface whatever `message` the 401 body contains.
- `Session` (`src/types/index.ts`) needs a third field to hold the token — nothing currently
  authenticates any request, so this is new surface, not a rename. Store it the same way `Session`
  is stored today (`sessionStorage`, key `farma-te-acerca:session`).
- Every other endpoint below requires `Authorization: Bearer <accessToken>`.

**Forgot/reset password** — `ForgotPasswordDialog` (`src/components/auth/ForgotPasswordDialog.tsx`)
is already built as a 3-step email → code → new-password wizard and is currently fully inert (no
handlers wired). It maps directly:

```
Step 1 → POST /auth/forgot-password   { "email": "..." }        → { "ok": true } (always, even if unknown)
Step 3 → POST /auth/reset-password    { "email", "code", "newPassword" } → { "ok": true }
                                       400 → { "message": "Código inválido o expirado." }
```

"Reenviar código" just calls `/auth/forgot-password` again. Requires the Supabase project's
password-reset email template to be set to include `{{ .Token }}` (the API repo's `README.md` §1
step 4 already covers this — it's a dashboard setting, not something the frontend needs to do).

**Azure/365 SSO** — the "Iniciar sesión con Microsoft 365" button is currently a fake shortcut
(`handleLogin("usuario.365@farmacity.com", role)`, no real OAuth). The API's `JwtAuthGuard` will
accept a real Supabase-issued token from any sign-in method once wired, but making the button work
for real needs the frontend to hold `@supabase/supabase-js` + the anon key directly (OAuth redirect
flows are a client-side concern, not proxied through the API) and call
`supabase.auth.signInWithOAuth({ provider: 'azure' })`, then resolve the session via `GET /auth/me`.
This can't be exercised end-to-end yet — it needs Farmacity's real Azure AD tenant credentials
(DEVIATIONS.md §7). Treat the button as still-a-stub for now unless those credentials show up.

## 3. Conventions that apply to every endpoint below

- `Authorization: Bearer <accessToken>` on everything except `/auth/login`, `/auth/forgot-password`,
  `/auth/reset-password`.
- Error body shape: `{ "statusCode": number, "message": string | string[], "error": string }` —
  `message` is an array of strings specifically for validation errors (bad DTO shape), a single
  string otherwise.
- `RequestStatus` strings come back exactly as the frontend's union already expects
  (`"Activa" | "En curso" | "Cancelada" | "Finalizada"`) — no mapping needed on the frontend side,
  that translation already happens API-side (`src/common/status.util.ts` in the API repo).
- Date fields (`date`) are pre-formatted `dd/mm/yyyy` strings (`es-AR` locale) — same format the
  mock data already used, so nothing reformats them today and nothing needs to start.
- 403 means wrong role for that route (`RolesGuard`) — redirect to the caller's own home, same as
  `RequireRole` already does for client-side route guarding.

## 4. Endpoints by screen

### Collaborator — `NewRequestPage` / `HistoryPage`

```
GET /branches
→ Branch[]  { id, name, region, zone }
```
Replaces the static `BRANCHES` array — used for both the "sucursal actual" and "sucursal deseada"
selects on `NewRequestPage`.

```
POST /requests
Body: { currentBranchId, desiredBranchId, reason, otherReason?, description? }
→ 201 RequestHistoryEntry  { id, branch, date, status }
→ 409 { message, existingRequestId, existingStatus }   ← duplicate active/en-curso request
```
- `reason` must be one of `"Mudanza" | "Movilidad" | "Estudios" | "Otro"`; `otherReason` is only
  read when `reason === "Otro"`.
- The 409 body maps directly to the inline conflict banner `NewRequestPage` already renders
  (`Ya tenés una solicitud <status> a esta sucursal (N° <id>)...`) — swap the client-side
  `hasExistingRequest` check for reading this response instead of preventing the call.
- **Open item:** a freshly created request comes back with `status: "Activa"`, not `"En curso"`
  like today's mock (`RequestsContext.addRequest`) — see DEVIATIONS.md §6, unresolved with the
  thesis director as of this writing. Confirm before assuming either value in the UI copy.

```
GET /requests
→ RequestHistoryEntry[]
```
Replaces the `history` array `RequestsContext` currently holds in memory — this can replace that
context's state entirely (fetch on mount) or be layered under it as a cache; either works, nothing
else depends on `RequestsContext`'s internals beyond `history`/`hasExistingRequest`/`addRequest`.

### Capital Humano — `HumanCapitalPage`

```
GET /hc/requests?desiredBranchId=<id>
→ HCRequest[]  { id, collaborator, employeeId, currentBranch, desiredBranch, reason, date, status, email }
```
Filter key is `desiredBranchId` — confirmed both by the DB query and by `CLAUDE.md`'s note that the
original design artifact filtered by the wrong field (`currentBranch`); this is already correct.

```
GET /hc/analytics?region=&zona=&desiredBranchId=&estado=&from=&to=
→ {
    kpis: { totalSolicitudes, activas, exitosas, successRate },   // successRate is a string like "47%"
    regionData: [{ region, requests }],
    statusData: [{ name, value, color }]
  }
```
All filters optional — call with none to reproduce today's global/unfiltered analytics view.
`kpis` replaces the hardcoded `KPIS` array (`totalSolicitudes`→"Total solicitudes",
`activas`→"Activas", `exitosas`→"Exitosas", `successRate`→"% de éxito"). `regionData`/`statusData`
replace `REGION_DATA`/`STATUS_DATA` verbatim, `color` included so nothing needs `STATUS_STYLES`
cross-referenced here.

```
GET /hc/requests/export?<same filters as analytics>
→ CSV file (Content-Disposition: attachment; filename="solicitudes.csv")
```
Wires "Descargar reporte" — since it needs the `Authorization` header, it can't be a plain
`<a href>`; fetch it, read the response as a blob, and trigger a download from that
(`URL.createObjectURL` + a synthetic anchor click), rather than navigating directly to the URL.

**"Contactar"** button — no endpoint. Per the case de uso's literal wording ("se abre un mail"),
this reads as a client-side `mailto:${request.email}` link, not a server-sent email — see
DEVIATIONS.md §5. `email` is already present on every `HCRequest`. Confirm this reading before
wiring it up; if a real templated server-sent email turns out to be wanted instead, that's new
backend scope, not something to build into the frontend as a workaround.

### DT — `DTPage`

```
GET /dt/nearby-employees?branchId=<id>
→ NearbyEmployee[]  { id, name, employeeId, currentBranch, distance, email }
→ 400 { message: "Sucursal sin coordenadas cargadas." }
```
`distance` is now a real haversine-computed string (`"2.8 km"`), sorted nearest-first, from each
colaborador's home address to the target sucursal — closer to the original mock's format
(`"1.8 km"`) than the placeholder it briefly returned mid-build. **Note:** `DTPage` today never
actually passes the selected `branch` into its (mocked) data — `NEARBY_EMPLOYEES` renders
unfiltered regardless. That needs fixing as part of this integration (pass `branch.id` into the
fetch), it's not something to preserve.

**"Solicitar cobertura"** button — same `mailto:` treatment as "Contactar" above, using the
`email` field already on `NearbyEmployee`.

## 5. Open items — read before wiring the affected screen

1. **New solicitud initial estado** (`Activa` vs `En curso`) — DEVIATIONS.md §6, unresolved.
2. **"Contactar" / "Solicitar cobertura"** — `mailto:` client-side vs. a real server-sent email —
   DEVIATIONS.md §5, needs a decision before those two buttons are wired up.
3. **DT branch filter** — `DTPage` needs a small fix (pass the selected branch into the fetch) that
   the mock never needed, since it never filtered.
4. **Azure/365 SSO** — not testable end-to-end without Farmacity's real tenant credentials
   (DEVIATIONS.md §7) — leave the button as a stub.

## 6. Suggested request helper (not prescriptive)

A single wrapper that injects the token and normalizes 401s covers every call above:

```ts
async function apiFetch(path: string, options: RequestInit = {}) {
  const session = getSession(); // however AuthContext ends up exposing it
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (res.status === 401) {
    // token missing/expired/invalid — bounce to /login, same as RequireAuth does today
  }
  return res;
}
```

No refresh-token flow is required for this to work — `expiresIn` is 3600s (1 hour), plenty for a
thesis demo session; letting it expire and redirecting to `/login` on the next 401 is enough.

## 7. Demo accounts (seeded, password `Demo1234!` for all)

23 cuentas: 1 `hc` y 1 `dt` (ambas en Palermo) + 21 `collaborator` repartidos en las 8 sucursales
(incluida Uruguay), cada una con `Domicilio` cargado para que `/dt/nearby-employees` tenga
distancias reales y variadas. Para probar HC/DT alcanza con 10002/10003; el resto de los legajos
`collaborator` (10001, 10004–10022) sirven para ver volumen en las listas y en el ranking por
distancia.

| legajo | rol | nombre | sucursal asignada |
|---|---|---|---|
| 10001 | collaborator | Colaborador Demo | Farmacity Palermo |
| 10002 | hc | Capital Humano Demo | Farmacity Palermo |
| 10003 | dt | DT Demo | Farmacity Palermo |
| 10004 | collaborator | Martina Suárez | Farmacity Belgrano |
| 10005 | collaborator | Diego Ramallo | Farmacity Rosario Centro |
| 10006 | collaborator | Sofía Martínez | Farmacity Palermo |
| 10007 | collaborator | Tomás Fernández | Farmacity Palermo |
| 10008 | collaborator | Valentina López | Farmacity Belgrano |
| 10009 | collaborator | Agustín Díaz | Farmacity Belgrano |
| 10010 | collaborator | Camila Torres | Farmacity Rosario Centro |
| 10011 | collaborator | Franco Romero | Farmacity Rosario Centro |
| 10012 | collaborator | Julieta Sosa | Farmacity Córdoba Nueva Córdoba |
| 10013 | collaborator | Matías Herrera | Farmacity Córdoba Nueva Córdoba |
| 10014 | collaborator | Lucía Acosta | Farmacity Córdoba Nueva Córdoba |
| 10015 | collaborator | Nicolás Molina | Farmacity Mendoza Centro |
| 10016 | collaborator | Florencia Rojas | Farmacity Mendoza Centro |
| 10017 | collaborator | Bruno Castro | Farmacity Salta Centro |
| 10018 | collaborator | Milagros Vega | Farmacity Salta Centro |
| 10019 | collaborator | Rodrigo Ibáñez | Farmacity Montevideo Pocitos |
| 10020 | collaborator | Antonella Ferreira | Farmacity Montevideo Pocitos |
| 10021 | collaborator | Emiliano Paz | Farmacity Mar del Plata |
| 10022 | collaborator | Catalina Núñez | Farmacity Mar del Plata |
| 10023 | collaborator | Ignacio Pedrosa | Farmacity Palermo |

## 8. Full endpoint reference

| Method | Path | Role | Body / Query | Response |
|---|---|---|---|---|
| POST | `/auth/login` | — | `{legajo, password}` | `{accessToken, refreshToken, expiresIn, user}` |
| POST | `/auth/forgot-password` | — | `{email}` | `{ok: true}` |
| POST | `/auth/reset-password` | — | `{email, code, newPassword}` | `{ok: true}` |
| GET | `/auth/me` | any | — | `{id, legajo, fullName, role, email}` |
| GET | `/branches` | any | — | `Branch[]` |
| POST | `/requests` | collaborator | `{currentBranchId, desiredBranchId, reason, otherReason?, description?}` | `RequestHistoryEntry` |
| GET | `/requests` | collaborator | — | `RequestHistoryEntry[]` |
| GET | `/hc/requests` | hc | `?desiredBranchId=` | `HCRequest[]` |
| GET | `/hc/analytics` | hc | `?region=&zona=&desiredBranchId=&estado=&from=&to=` | `{kpis, regionData, statusData}` |
| GET | `/hc/requests/export` | hc | same as analytics | CSV file |
| GET | `/dt/nearby-employees` | dt | `?branchId=` | `NearbyEmployee[]` |
| GET | `/health` | — | — | `{status, timestamp}` |
