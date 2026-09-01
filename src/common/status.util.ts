import { Prisma } from '../../generated/prisma';

// Fixed closed set of solicitud estado business keys, one per
// `EstadoSolicitud.codigo` row. Written by hand for the same reason as
// `Rol`/`EstadoSolicitud` themselves: this is a lookup table, not a Postgres
// enum. Unlike `nombre` (the renamable Spanish display label), `codigo` is
// the stable identity every piece of fixed business logic below keys off —
// renaming an estado in the DB (editing `nombre`) must never break the
// state machine, the open-set check, or the display order, which is
// precisely what broke when this logic used to be keyed by `nombre`.
export const ESTADO_CODIGOS = [
  'ACTIVA',
  'EN_CURSO',
  'APROBADO',
  'NO_APROBADO',
  'FINALIZADA',
  'CANCELADA',
] as const;
export type EstadoCodigo = (typeof ESTADO_CODIGOS)[number];

// 'APROBADO' is still pending completion (HC approved the move but it
// hasn't happened yet) so it counts as open the same as 'ACTIVA'/'EN_CURSO'
// — it still blocks a duplicate request to the same sucursal.
export const OPEN_CODIGOS: EstadoCodigo[] = ['ACTIVA', 'APROBADO', 'EN_CURSO'];

export const CODIGO_ORDER: EstadoCodigo[] = [
  'ACTIVA',
  'APROBADO',
  'EN_CURSO',
  'FINALIZADA',
  'NO_APROBADO',
  'CANCELADA',
];

// State machine approved by the thesis director (see the diagram in the
// commit that introduced this, later amended to make 'NO_APROBADO'
// terminal): the edges a solicitud's estado is allowed to move along when
// HC changes it via PATCH /hc/requests/:id/status. 'FINALIZADA',
// 'CANCELADA' and 'NO_APROBADO' are all terminal (no outgoing edges) — once
// HC rejects a solicitud that's final, not a return to 'APROBADO'. Mirrored
// on the frontend as `ALLOWED_STATUS_TRANSITIONS` (src/data/constants.ts)
// so the status-change dialog only ever offers a legal next estado; this
// map is the source of truth and is enforced server-side regardless of
// what the client sends.
export const ALLOWED_TRANSITIONS: Record<
  EstadoCodigo,
  readonly EstadoCodigo[]
> = {
  ACTIVA: ['EN_CURSO'],
  EN_CURSO: ['APROBADO', 'NO_APROBADO', 'FINALIZADA', 'CANCELADA'],
  APROBADO: ['NO_APROBADO', 'FINALIZADA', 'CANCELADA'],
  NO_APROBADO: [],
  FINALIZADA: [],
  CANCELADA: [],
};

// `estado: true` (a full-record include, not a narrow `select`) so every
// consumer of this include gets `codigo`/`nombre`/`color` on the current
// historial row for free — no separate estados lookup needed to resolve
// display label or chart color for "the estado this solicitud is in now".
export const CURRENT_ESTADO_INCLUDE = {
  historial: {
    where: { fechaFin: null },
    take: 1,
    include: { estado: true },
  },
} satisfies Prisma.SolicitudInclude;

export function currentEstadoNombre(solicitud: {
  historial: { estado: { nombre: string } }[];
}): string {
  const current = solicitud.historial[0];
  if (!current) {
    throw new Error('Solicitud sin estado vigente (historial vacío).');
  }
  return current.estado.nombre;
}

// Business-key counterpart of currentEstadoNombre — this is what
// ALLOWED_TRANSITIONS/OPEN_CODIGOS checks resolve against, never the
// display name.
export function currentEstadoCodigo(solicitud: {
  historial: { estado: { codigo: string } }[];
}): string {
  const current = solicitud.historial[0];
  if (!current) {
    throw new Error('Solicitud sin estado vigente (historial vacío).');
  }
  return current.estado.codigo;
}

export function formatDateEsAr(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

// Same as formatDateEsAr but with hour:minute, for the solicitud's
// estado-change timeline where the time of day (not just the day) matters.
// Date and time are formatted separately and joined with " · " (middle dot)
// instead of the locale's default ", " separator — a frontend design call.
export function formatDateTimeEsAr(date: Date): string {
  const datePart = formatDateEsAr(date);
  const timePart = date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  return `${datePart} · ${timePart}`;
}
