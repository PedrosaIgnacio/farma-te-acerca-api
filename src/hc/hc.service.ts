import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';
import {
  EstadoNombre,
  STATUS_COLOR,
  STATUS_ORDER,
  formatDateEsAr,
} from '../common/status.util';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

const HC_REQUEST_INCLUDE = {
  colaborador: true,
  sucursalActual: true,
  sucursalDeseada: true,
  estadoActual: true,
} satisfies Prisma.SolicitudInclude;

type SolicitudWithRelations = Prisma.SolicitudGetPayload<{
  include: typeof HC_REQUEST_INCLUDE;
}>;

@Injectable()
export class HcService {
  constructor(private readonly prisma: PrismaService) {}

  async findRequestsByDesiredBranch(desiredBranchId: number) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where: { sucursalDeseadaId: desiredBranchId },
      orderBy: { fechaCreacion: 'desc' },
      include: HC_REQUEST_INCLUDE,
    });

    return solicitudes.map(toHcRequest);
  }

  // Transitions a solicitud to a new estado. Per DEVIATIONS.md §9, this must
  // atomically: 1) close the currently-open CambioEstadoSolicitud interval,
  // 2) open a new one for the target estado, 3) update the denormalized
  // Solicitud.estadoActualId cache to match.
  async updateRequestStatus(id: number, status: EstadoNombre, motivo: string) {
    const solicitud = await this.prisma.solicitud.findUnique({
      where: { id },
      include: HC_REQUEST_INCLUDE,
    });
    if (!solicitud) {
      throw new NotFoundException('Solicitud inexistente.');
    }
    if (solicitud.estadoActual.nombre === status) {
      return toHcRequest(solicitud);
    }

    const nuevoEstado = await this.prisma.estadoSolicitud.findUniqueOrThrow({
      where: { nombre: status },
    });

    await this.prisma.$transaction([
      this.prisma.cambioEstadoSolicitud.updateMany({
        where: { solicitudId: id, fechaFin: null },
        data: { fechaFin: new Date() },
      }),
      this.prisma.cambioEstadoSolicitud.create({
        data: { solicitudId: id, estadoId: nuevoEstado.id, motivo },
      }),
      this.prisma.solicitud.update({
        where: { id },
        data: { estadoActualId: nuevoEstado.id },
      }),
    ]);

    const updated = await this.prisma.solicitud.findUniqueOrThrow({
      where: { id },
      include: HC_REQUEST_INCLUDE,
    });
    return toHcRequest(updated);
  }

  async getAnalytics(filters: AnalyticsQueryDto) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where: this.buildWhere(filters),
      select: {
        estadoActual: { select: { nombre: true } },
        sucursalDeseada: {
          select: {
            provincia: { select: { region: { select: { nombre: true } } } },
          },
        },
      },
    });

    const total = solicitudes.length;
    const activas = solicitudes.filter(
      (s) => s.estadoActual.nombre === 'Activa',
    ).length;
    const exitosas = solicitudes.filter(
      (s) => s.estadoActual.nombre === 'Finalizada',
    ).length;
    const successRate = total === 0 ? 0 : Math.round((exitosas / total) * 100);

    const byRegion = new Map<string, number>();
    for (const s of solicitudes) {
      const region = s.sucursalDeseada.provincia.region.nombre;
      byRegion.set(region, (byRegion.get(region) ?? 0) + 1);
    }
    const regionData = [...byRegion.entries()]
      .map(([region, requests]) => ({ region, requests }))
      .sort((a, b) => b.requests - a.requests);

    const byStatus = new Map<EstadoNombre, number>();
    for (const s of solicitudes) {
      const estado = s.estadoActual.nombre as EstadoNombre;
      byStatus.set(estado, (byStatus.get(estado) ?? 0) + 1);
    }
    const statusData = STATUS_ORDER.map((estado) => ({
      name: estado,
      value: byStatus.get(estado) ?? 0,
      color: STATUS_COLOR[estado],
    }));

    return {
      kpis: {
        totalSolicitudes: total,
        activas,
        exitosas,
        successRate: `${successRate}%`,
      },
      regionData,
      statusData,
    };
  }

  async exportCsv(filters: AnalyticsQueryDto): Promise<string> {
    const solicitudes = await this.prisma.solicitud.findMany({
      where: this.buildWhere(filters),
      orderBy: { fechaCreacion: 'desc' },
      include: {
        colaborador: true,
        sucursalActual: true,
        sucursalDeseada: true,
        estadoActual: true,
      },
    });

    const header = [
      'id',
      'colaborador',
      'legajo',
      'sucursal_actual',
      'sucursal_deseada',
      'motivo',
      'fecha',
      'estado',
      'email',
    ].join(',');
    const rows = solicitudes.map((solicitud) =>
      [
        solicitud.id,
        solicitud.colaborador.nombre,
        solicitud.colaborador.legajo,
        solicitud.sucursalActual.nombre,
        solicitud.sucursalDeseada.nombre,
        solicitud.motivo,
        formatDateEsAr(solicitud.fechaCreacion),
        solicitud.estadoActual.nombre,
        solicitud.colaborador.email,
      ]
        .map(csvEscape)
        .join(','),
    );

    return [header, ...rows].join('\n');
  }

  private buildWhere(filters: AnalyticsQueryDto): Prisma.SolicitudWhereInput {
    const where: Prisma.SolicitudWhereInput = {};
    if (filters.desiredBranchId) {
      where.sucursalDeseadaId = filters.desiredBranchId;
    }
    if (filters.estado) {
      where.estadoActual = { nombre: filters.estado };
    }
    if (filters.region) {
      where.sucursalDeseada = {
        provincia: { region: { nombre: filters.region } },
      };
    }
    if (filters.from || filters.to) {
      where.fechaCreacion = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }
    return where;
  }
}

function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Shape matches the frontend's `HCRequest` type (src/types/index.ts).
function toHcRequest(solicitud: SolicitudWithRelations) {
  return {
    id: solicitud.id,
    collaborator: solicitud.colaborador.nombre,
    employeeId: solicitud.colaborador.legajo,
    currentBranch: solicitud.sucursalActual.nombre,
    desiredBranch: solicitud.sucursalDeseada.nombre,
    reason: solicitud.motivo,
    date: formatDateEsAr(solicitud.fechaCreacion),
    status: solicitud.estadoActual.nombre,
    email: solicitud.colaborador.email,
  };
}
