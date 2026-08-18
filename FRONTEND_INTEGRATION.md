# Frontend integration guide — Actualización: base de datos normalizada (agosto 2026)

Para la sesión trabajando en `farma-te-acerca` (el frontend). La integración original ya está
hecha (`farma-te-acerca` commit `ce3f417`, "Integrate frontend with the farma-te-acerca-api
backend") siguiendo el `FRONTEND_INTEGRATION.md` de aquel momento. Este documento reemplaza a
aquel — cubre **solo lo que cambió** desde entonces: el backend migró su base de datos a un
esquema más normalizado (tablas `Roles`/`Estados_Solicitud` en vez de enums, jerarquía real
`Regiones`→`Provincias` en vez de strings sueltos `region`/`zona`). El detalle completo de esa
migración y su razonamiento está en `DEVIATIONS.md` (§2, §8-§13) — este archivo es el resumen
accionable para el lado frontend.

**Buenas noticias primero:** de los ~19 archivos que la integración original tocó, esta migración
solo requiere tocar **un archivo, dos interfaces, tres líneas** (`src/types/index.ts`). Nada más
lee esos campos hoy — confirmado por grep en todo `src/` antes de escribir esto.

## 1. Qué NO cambió

Todos los endpoints devuelven exactamente el mismo shape que ya está integrado. Esto sigue
funcionando sin tocar nada:

- `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`
- `POST /requests`, `GET /requests`
- `GET /hc/requests`
- `GET /hc/analytics` (salvo el parámetro `zona`, ver abajo) y `GET /hc/requests/export`
- `GET /dt/nearby-employees`
- Las 25 cuentas demo (mismos legajos, mismo password `Demo1234!`) — no cambiaron ids, roles ni
  sucursales asignadas.
- Todo el flujo de auth (Supabase Auth, JWT, SSO 365) — sin cambios.

## 2. Qué SÍ cambió — dos cambios, ambos en `src/types/index.ts`

### 2.1 `Branch.zone` → `Branch.provincia`

`GET /branches` cambia de shape:

```json
// antes
{ "id": 1, "name": "Farmacity Palermo", "region": "CABA", "zone": "Norte" }

// después
{ "id": 1, "name": "Farmacity Palermo", "region": "CABA", "provincia": "Ciudad Autónoma de Buenos Aires" }
```

`region` ahora es una de 7 regiones reales de Argentina (antes era un string libre por sucursal
sin relación con `zone`):

`Nuevo Cuyo` · `Centro / Pampeana` · `Noroeste (NOA)` · `Nordeste (NEA)` · `Patagonia` · `CABA` ·
`Internacional` (solo Farmacity Montevideo Pocitos, la única sucursal fuera del país)

**Cambio en `src/types/index.ts:61-66`:**

```diff
 export interface Branch {
   id: number;
   name: string;
   region: string;
-  zone: string;
+  provincia: string;
 }
```

Grepeamos `src/` completo por `.zone`/`.zona` (acceso a la propiedad, no solo el nombre del campo
en el tipo) y **ningún componente la lee hoy** — ni `BranchSelect.tsx` (usa `b.region`, sin tocar)
ni ningún otro. Este es un cambio de tipo puro, sin impacto en runtime ni en JSX.

### 2.2 `AnalyticsFilters.zona` se elimina

`GET /hc/analytics` / `GET /hc/requests/export` pierden el query param `zona`. `region` se
mantiene pero ahora debe ser uno de los 7 valores de la lista de arriba.

**Cambio en `src/types/index.ts:39-46`:**

```diff
 export interface AnalyticsFilters {
   region?: string;
-  zona?: string;
   desiredBranchId?: number;
   estado?: RequestStatus;
   from?: string;
   to?: string;
 }
```

Grepeamos y `AnalyticsFilters` **no está importado en ningún otro archivo** — `HumanCapitalPage.tsx`
llama `apiJson<AnalyticsResponse>("/hc/analytics")` sin pasar ningún filtro todavía. Cero impacto
en runtime hoy; el tipo queda correcto para cuando se conecte un filtro de región a la UI.

## 3. Decisiones de negocio a tener en cuenta (no requieren código, solo contexto)

- **Ya no hay trazabilidad de "quién" cambió el estado de una solicitud** — nunca se expuso por
  API, así que no rompe nada existente, pero si se pide una feature de auditoría por usuario en el
  frontend, el backend necesitaría agregar esa columna de nuevo primero (`DEVIATIONS.md §8`).
- El **motivo de traslado** (`reason`/`otherReason`, sin cambios en el contrato) se mantiene pese a
  que el nuevo diagrama de la tesis no lo incluye — el frontend ya depende de él (`DEVIATIONS.md
  §13`).
- El **id de colaborador** sigue siendo el mismo UUID de siempre. Nada de autenticación cambia.

## 4. Verificación sugerida

1. Aplicar los dos diffs de `src/types/index.ts` de arriba.
2. `npm run build` / `tsc` en el frontend — no debería haber ningún otro error de tipos, dado que
   nada más referencia `zone`/`zona`.
3. Correr la app contra el backend ya migrado (`yarn start:dev` en `farma-te-acerca-api/`, mismo
   `VITE_API_BASE_URL` de siempre) y confirmar a mano:
   - `NewRequestPage`/`BranchSelect`: la lista de sucursales sigue cargando y mostrando `region`
     correctamente (ahora con los nombres de región argentinos reales).
   - `HumanCapitalPage`: el gráfico de barras por región (`regionData`) sigue renderizando —los
     nombres de región en el eje X van a verse distintos a los de antes (`CABA`, `Santa Fe`, etc.
     eran nombres de provincia usados como región; ahora son las 7 regiones reales).
   - Login con cualquier cuenta demo (ej. `10001`/`Demo1234!`) sigue funcionando igual.

Para el detalle de cada decisión de diseño de esta migración (por qué se tomó, qué se descartó),
ver `DEVIATIONS.md` en este repo.
