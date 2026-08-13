import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, RequestStatus } from '../../generated/prisma';
import {
  formatDateEsAr,
  fromStatusLabel,
  STATUS_COLOR,
  toStatusLabel,
} from '../common/status.util';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

const STATUS_ORDER: RequestStatus[] = [
  'Activa',
  'EnCurso',
  'Finalizada',
  'Cancelada',
];

@Injectable()
export class HcService {
  constructor(private readonly prisma: PrismaService) {}

  async findRequestsByDesiredBranch(desiredBranchId: number) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where: { sucursalDeseadaId: desiredBranchId },
      orderBy: { fecha: 'desc' },
      include: {
        colaborador: true,
        sucursalActual: true,
        sucursalDeseada: true,
      },
    });

    // Shape matches the frontend's `HCRequest` type (src/types/index.ts).
    return solicitudes.map((solicitud) => ({
      id: solicitud.id,
      collaborator: solicitud.colaborador.fullName,
      employeeId: solicitud.colaborador.legajo,
      currentBranch: solicitud.sucursalActual.nombre,
      desiredBranch: solicitud.sucursalDeseada.nombre,
      reason: solicitud.reason,
      date: formatDateEsAr(solicitud.fecha),
      status: toStatusLabel(solicitud.estado),
      email: solicitud.colaborador.email,
    }));
  }

  async getAnalytics(filters: AnalyticsQueryDto) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where: this.buildWhere(filters),
      select: { estado: true, sucursalDeseada: { select: { region: true } } },
    });

    const total = solicitudes.length;
    const activas = solicitudes.filter((s) => s.estado === 'Activa').length;
    const exitosas = solicitudes.filter(
      (s) => s.estado === 'Finalizada',
    ).length;
    const successRate = total === 0 ? 0 : Math.round((exitosas / total) * 100);

    const byRegion = new Map<string, number>();
    for (const s of solicitudes) {
      const region = s.sucursalDeseada.region;
      byRegion.set(region, (byRegion.get(region) ?? 0) + 1);
    }
    const regionData = [...byRegion.entries()]
      .map(([region, requests]) => ({ region, requests }))
      .sort((a, b) => b.requests - a.requests);

    const byStatus = new Map<RequestStatus, number>();
    for (const s of solicitudes) {
      byStatus.set(s.estado, (byStatus.get(s.estado) ?? 0) + 1);
    }
    const statusData = STATUS_ORDER.map((estado) => ({
      name: toStatusLabel(estado),
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
      orderBy: { fecha: 'desc' },
      include: {
        colaborador: true,
        sucursalActual: true,
        sucursalDeseada: true,
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
        solicitud.colaborador.fullName,
        solicitud.colaborador.legajo,
        solicitud.sucursalActual.nombre,
        solicitud.sucursalDeseada.nombre,
        solicitud.reason,
        formatDateEsAr(solicitud.fecha),
        toStatusLabel(solicitud.estado),
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
      where.estado = fromStatusLabel(filters.estado);
    }
    if (filters.region || filters.zona) {
      where.sucursalDeseada = {
        ...(filters.region ? { region: filters.region } : {}),
        ...(filters.zona ? { zona: filters.zona } : {}),
      };
    }
    if (filters.from || filters.to) {
      where.fecha = {
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
