# Deviations from the approved Análisis Funcional

Running log of every place this implementation diverges from the PDF approved
by the thesis director ("Tesis Analista de Sistemas – Martin Saleme"). Fold
these back into the document when it's next revised — each entry says what
changed and why.

## 1. Authentication model (Caso de uso: LOGIN / diagrama de clases)

The approved diagram gives `Colaborador` its own `username`/`Pass` columns.
This implementation instead uses **Supabase Auth** (`auth.users`) as the
credential store — `Profile` (this repo's stand-in for `Colaborador`) has no
password field at all.

**Why:** Supabase Auth is free, includes a **native Azure AD provider** that
directly satisfies the diagnóstico's "SSO con usuario de 365" requirement
without custom OAuth code, and gives free transactional email for the
password-reset flow. Reimplementing all of that by hand (hashing, lockout
storage, email delivery) would cost real effort for no benefit over what
Supabase already provides on its free tier.

**How it works instead:** `Profile.email` is matched against the Supabase
user's email on every request (`JwtAuthGuard`, `src/auth/guards/jwt-auth.guard.ts`)
— not by comparing ids — so both a legajo/password login and an Azure/365 SSO
login resolve to the same `Profile` row regardless of which one first created
the `auth.users` entry. `Profile.failedAttempts` implements the "block after
5 intentos" rule by hand, since Supabase Auth doesn't enforce that itself; it
resets to 0 only when the colaborador successfully resets their password —
the same unlock path the case de uso's alternate course already describes.

## 2. `Estados` modeled as an enum, not a table

The diagram has a separate `Estados` lookup table (`id_estado`, `descripcion`,
`activo`). This implementation uses a fixed Postgres enum (`RequestStatus`:
`Activa` / `En curso` / `Cancelada` / `Finalizada`) instead.

**Why:** the four states are fixed by the functional spec and the frontend's
`RequestStatus` union — a lookup table only pays off if the set of states
needs to change without a deploy, which isn't a stated requirement.

## 3. Contact info collapsed to one email + one phone

The diagram's `colab_mail` and `colab_TE` tables support multiple
emails/phones per colaborador (with a "tipo" per entry). `Profile` has a
single `email` (also the Supabase Auth login identity) and a single optional
`phone`. (`colab_domicilio` — the diagram's other contact table — is *not*
part of this deviation anymore: it's back, in simplified form, as `Domicilio`.
See §4.)

**Why:** nothing in the 5 casos de uso reads or writes a second email/phone —
this is scope not exercised by the approved spec. Straightforward to split
into a table later if a real requirement shows up.

## 4. `Domicilio` simplified from the diagram's `colab_domicilio`

`Domicilio` (1:1 with `Profile`) keeps `calle`/`localidad`/`provincia` as
optional display fields but adds required `lat`/`lng`, entered manually (no
geocoding service integration) — this is what `GET /dt/nearby-employees`
now uses to compute real distance (haversine, `src/common/geo.util.ts`) from
each colaborador's home address to the target sucursal, replacing the
same-zona/región qualitative label the first pass shipped with. `Sucursal`
also gained `lat`/`lng` for the same reason.

**Why:** the case de uso is about who lives close enough to cover a
contingency shift — that's a distance from home, not from wherever the
colaborador happens to be currently assigned, and it's exactly what the
diagram's `colab_domicilio` existed for. Kept to lat/lng (+ optional address
text for display) rather than the full diagram shape since nothing else reads
a structured Calle/Localidad/Provincia today.

## 5. "Contactar" / "Solicitar cobertura" — open question, likely mailto:

Both case de uso descriptions say the click "abre un mail" (opens a mail) to
inform the colaborador — read literally, that's a client-side `mailto:` link
built from the `email` field the API already returns on both the HC
requests-by-branch response and the DT nearby-employees response, **not** a
server-sent email. No email-sending endpoint was built for this. Confirm this
reading before wiring up the frontend buttons; if a real server-sent email
with a formal template is actually wanted, that's new scope (needs an email
provider beyond what Supabase Auth's own transactional emails cover).

## 6. Open item: a new solicitud's initial estado

`POST /requests` sets a newly created solicitud's `estado` to **`Activa`**
(read as "just submitted, not yet acted on"). The current frontend mock
(`RequestsContext.addRequest`) sets new entries directly to `"En curso"`
instead. Neither the case de uso nor the diagram says which is correct —
confirm with the thesis director and align both sides during frontend
integration.

## 7. SSO 365 — configured, not yet connectable end-to-end

`JwtAuthGuard` accepts any valid Supabase-issued token regardless of sign-in
method, so Azure/365 SSO works at the code level once Supabase's Azure
provider is turned on in the dashboard. It hasn't been exercised end-to-end
because that requires Farmacity's real Azure AD app registration/tenant
credentials, which this thesis project doesn't have access to. Treat as
configured-but-unverified until those credentials exist.
