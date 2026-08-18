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

## 2. `Estados` modeled as an enum, not a table — RESUELTA

**Resuelto por la migración a la base normalizada (agosto 2026).** `Estados`
(`EstadoSolicitud`) y `Roles` (`Rol`) pasan a ser tablas reales, siguiendo el
diagrama al pie de la letra. La aplicación conserva type-safety en
TypeScript vía union types escritos a mano (`Role` en `src/auth/types.ts`,
`EstadoNombre` en `src/common/status.util.ts`), resueltos contra esas tablas
por `nombre` (columna `@unique`) mediante relation filters / `connect` —
sin capa de caché de ids. Ver también §7-§13 más abajo.

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

## 8. `Cambio_Estado_Solicitud` no registra quién ejecutó el cambio

A diferencia de la implementación anterior (`SolicitudEstado.colabId`), el
diagrama modela esta tabla solo con `fecha_inicio`/`fecha_fin`/
`id_estado_solicitud`/`id_solicitud`. Se sigue el diagrama literalmente.

**Por qué:** decisión explícita al planificar la migración a la base
normalizada — se prioriza seguir el diagrama al pie de la letra sobre
preservar esta trazabilidad, que hoy no se expone por ningún endpoint. Se
pierde la posibilidad de saber "qué colaborador ejecutó" cada transición de
estado; cualquier feature futura de auditoría por usuario deberá agregar esa
columna de nuevo.

## 9. `Solicitud.estadoActualId` — RESUELTA

Se había agregado un FK denormalizado (`Solicitud.estadoActualId`) que
cacheaba la fila de `Cambio_Estado_Solicitud` con `fecha_fin IS NULL`, para
evitar una subquery correlacionada en las consultas de `HcService` que
filtran/agrupan por estado (analytics, export CSV, "solicitudes por
sucursal"). El diagrama no tiene ese campo — calcula el estado vigente de
una solicitud directamente como la fila de `Cambio_Estado_Solicitud` con
`fecha_fin IS NULL`.

**Resolución:** se quitó `estadoActualId` de `Solicitud` a pedido explícito
del director de tesis — el diagrama se sigue al pie de la letra en este
punto, sin la cache denormalizada. `CURRENT_ESTADO_INCLUDE`/
`currentEstadoNombre` en `src/common/status.util.ts` centralizan el patrón
"traer/leer la fila de `historial` con `fechaFin: null`" para que cada
service no repita esa lógica. `CambioEstadoSolicitud` gana índices
(`solicitudId, fechaFin`) y (`estadoId, fechaFin`) para que ese lookup y los
filtros por estado sigan siendo baratos sin la cache. Cualquier código que
transicione el estado de una solicitud debe seguir haciendo, en una
transacción: 1) cerrar el intervalo abierto vigente en
`CambioEstadoSolicitud` (`fechaFin = now()`), 2) crear uno nuevo
(`fechaInicio = now()`, `fechaFin = null`) — ya no hay un tercer paso de
sincronización.

## 10. `Colab_Sucursales` mantiene id propio, no la PK compuesta del diagrama

El diagrama define `Colab_Sucursales` con PK compuesta
(`id_colab`, `id_sucursal`) — un colaborador solo podría tener una fila
histórica por sucursal. Esta implementación (`ColabSucursal`) mantiene su
propio id autoincremental + índice (`colabId`, `activo`), igual que la
implementación anterior (`ColaboradorSucursal`).

**Por qué:** permite reasignar a un colaborador a la misma sucursal más de
una vez en momentos distintos (ej: vuelve a una sucursal donde ya trabajó
antes), preservando el historial completo de asignaciones.

## 11. `Sucursal.region`/`zona` y `Domicilio.provincia` → jerarquía `Region`→`Provincia`

La implementación anterior tenía `Sucursal.region`/`Sucursal.zona` y
`Domicilio.provincia` como strings sueltos, sin relación entre sí. Se
reemplazan por las tablas normalizadas `Region`/`Provincia` del diagrama
(`ColabDomicilio.provinciaId` y `Sucursal.provinciaId`, ambas apuntando a la
misma jerarquía). El concepto de "zona" desaparece — no existe en el
diagrama nuevo.

**Datos del seed:** `Region`/`Provincia` se siembran con las 6 regiones
oficiales de Argentina y las 24 provincias (ids explícitos provistos por el
director de tesis), más una región "Internacional" (id 7) y una provincia
"Montevideo" (id 25) agregadas — no forman parte de la lista oficial — para
cubrir la única sucursal/colaboradores demo fuera de Argentina (Farmacity
Montevideo Pocitos).

**Impacto en la API:** `GET /branches` pierde el campo `zone` y gana
`provincia`; el valor de `region` pasa a ser una de las 6 regiones
argentinas oficiales (o "Internacional") en vez de los strings libres
anteriores (`CABA`, `Santa Fe`, `Uruguay`, etc). El query param `zona` de
`GET /hc/analytics` / `GET /hc/requests/export` se elimina; `region` ahora
debe ser uno de esos 7 valores. Ver `MIGRATION_NOTES.md`.

## 12. `ColabDomicilio.localidad` — no está en el diagrama

El diagrama define `Colab_Domicilios` solo con `calle`/`id_provincia`/
`lat`/`lng`. Se mantiene `localidad` como campo adicional de solo
visualización, igual que la implementación anterior.

**Por qué:** conveniencia ya usada por el seed de datos demo (ej. "Rosario",
"Ciudad de Mendoza"), sin costo real — nada más la relee hoy.

## 13. `Solicitud.motivo`/`otroMotivo` — no están en el diagrama

El diagrama nuevo no incluye motivo de traslado en `Solicitudes`. Se
mantienen (`motivo`/`otroMotivo`, antes `reason`/`otherReason`) como
continuación explícita de la decisión ya tomada para la implementación
anterior.

**Por qué:** el frontend ya depende de este campo (tipo `Reason`,
`src/types/index.ts`); eliminarlo sería una regresión de producto, no una
simplificación pedida por nadie.

## 14. `CambioEstadoSolicitud.motivo` — no está en el diagrama

Se agrega `motivo` (nullable) a `CambioEstadoSolicitud` para que HC pueda
registrar por qué cambió el estado de una solicitud, capturado en un modal
que dispara un menú kebab por fila en `HumanCapitalPage` (`PATCH
/hc/requests/:id/status`, ahora con `{ status, motivo }`).

**Por qué:** pedido explícito para la feature de cambio de estado — sin
este campo, HC no tiene forma de dejar constancia del motivo de la
transición, algo que el §8 ya identificaba como trazabilidad perdida
respecto a la implementación anterior (aunque ahí se refería a "quién", no
a "por qué").

Es nullable porque: 1) la fila inicial en "Activa" que crea
`RequestsService.create` no es una transición real, y 2) las filas de
`historial` creadas antes de este campo no tienen motivo.
