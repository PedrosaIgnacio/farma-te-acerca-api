import { RequestStatus } from '../../generated/prisma';

// Prisma enum members are valid JS identifiers (`EnCurso`), but the frontend
// (src/types/index.ts, `RequestStatus`) expects the literal Spanish labels
// used in the case de uso ("En curso"). `@map` in schema.prisma only renames
// the DB column value, not the JS enum member, so every response DTO must
// go through this before serialization.
const STATUS_LABEL: Record<RequestStatus, string> = {
  Activa: 'Activa',
  EnCurso: 'En curso',
  Cancelada: 'Cancelada',
  Finalizada: 'Finalizada',
};

export function toStatusLabel(status: RequestStatus): string {
  return STATUS_LABEL[status];
}

const LABEL_TO_STATUS: Record<string, RequestStatus> = {
  Activa: 'Activa',
  'En curso': 'EnCurso',
  Cancelada: 'Cancelada',
  Finalizada: 'Finalizada',
};

export const STATUS_LABELS = Object.keys(LABEL_TO_STATUS);

export function fromStatusLabel(label: string): RequestStatus {
  return LABEL_TO_STATUS[label];
}

// Matches the frontend's `STATUS_DATA` colors (src/data/mockData.ts) exactly,
// since the pie chart currently sources color straight from the data layer.
export const STATUS_COLOR: Record<RequestStatus, string> = {
  Activa: '#0284C7',
  EnCurso: '#D97706',
  Finalizada: '#1F7A4D',
  Cancelada: '#78716C',
};

export function formatDateEsAr(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}
