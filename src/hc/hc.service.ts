import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';
import {
  ALLOWED_TRANSITIONS,
  CODIGO_ORDER,
  EstadoCodigo,
  CURRENT_ESTADO_INCLUDE,
  currentEstadoCodigo,
  currentEstadoNombre,
  formatDateEsAr,
} from '../common/status.util';
import { RequestsService } from '../requests/requests.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { CreateHcRequestDto } from './dto/create-hc-request.dto';
import { HcRequestsQueryDto } from './dto/hc-requests-query.dto';

const HC_REQUEST_INCLUDE = {
  colaborador: true,
  sucursalActual: true,
  sucursalDeseada: true,
  ...CURRENT_ESTADO_INCLUDE,
} satisfies Prisma.SolicitudInclude;

type SolicitudWithRelations = Prisma.SolicitudGetPayload<{
  include: typeof HC_REQUEST_INCLUDE;
}>;

@Injectable()
export class HcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestsService: RequestsService,
  ) {}

  // Same role/activo/current-branch shape as DtService.findNearby's
  // candidate query — mirrors it rather than introducing a different way
  // to resolve "a colaborador's current branch" a third time.
  async findCollaborators() {
    const colaboradores = await this.prisma.colaborador.findMany({
      where: { rol: { nombre: 'collaborator', activo: true }, activo: true },
      orderBy: { nombre: 'asc' },
      include: {
        sucursales: {
          where: { activo: true },
          include: { sucursal: true },
          take: 1,
        },
      },
    });

    return colaboradores.map((c) => ({
      id: c.id,
      legajo: c.legajo,
      name: c.nombre,
      currentBranchId: c.sucursales[0]?.sucursal.id ?? null,
      currentBranch: c.sucursales[0]?.sucursal.nombre ?? null,
    }));
  }

  async createRequest(dto: CreateHcRequestDto) {
    const { colabId, ...rest } = dto;
    return this.requestsService.create(colabId, rest);
  }

  async findRequests(filters: HcRequestsQueryDto) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        activo: true,
        ...(filters.desiredBranchId
          ? { sucursalDeseadaId: filters.desiredBranchId }
          : {}),
      },
      orderBy: { fechaCreacion: 'desc' },
      include: HC_REQUEST_INCLUDE,
    });

    return solicitudes.map(toHcRequest);
  }

  // Transitions a solicitud to a new estado. Per DEVIATIONS.md §9, a
  // solicitud's estado is purely derived from CambioEstadoSolicitud, so this
  // must atomically: 1) close the currently-open interval (`fechaFin =
  // now()`), 2) open a new one for the target estado. The target must be a
  // legal move per ALLOWED_TRANSITIONS (the approved state-machine diagram)
  // — this is the enforcement point, so a request can't reach an illegal
  // estado even if a client bypasses the frontend's own guard. Both the
  // current and target estado are resolved/compared by `codigo` (the
  // stable business key), not `nombre` — renaming an estado's display
  // label must never change what it's allowed to transition to.
  async updateRequestStatus(id: number, codigo: EstadoCodigo, motivo: string) {
    const solicitud = await this.prisma.solicitud.findFirst({
      where: { id, activo: true },
      include: HC_REQUEST_INCLUDE,
    });
    if (!solicitud) {
      throw new NotFoundException('Solicitud inexistente.');
    }
    const currentCodigo = currentEstadoCodigo(solicitud) as EstadoCodigo;
    if (currentCodigo === codigo) {
      return toHcRequest(solicitud);
    }

    const nuevoEstado = await this.prisma.estadoSolicitud.findFirstOrThrow({
      where: { codigo, activo: true },
    });

    if (!ALLOWED_TRANSITIONS[currentCodigo].includes(codigo)) {
      throw new ConflictException(
        `No es posible pasar de "${currentEstadoNombre(solicitud)}" a "${nuevoEstado.nombre}".`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.cambioEstadoSolicitud.updateMany({
        where: { solicitudId: id, fechaFin: null },
        data: { fechaFin: new Date() },
      }),
      this.prisma.cambioEstadoSolicitud.create({
        data: { solicitudId: id, estadoId: nuevoEstado.id, motivo },
      }),
    ]);

    const updated = await this.prisma.solicitud.findUniqueOrThrow({
      where: { id },
      include: HC_REQUEST_INCLUDE,
    });
    return toHcRequest(updated);
  }

  async getAnalytics(filters: AnalyticsQueryDto) {
    const [solicitudes, estados] = await Promise.all([
      this.prisma.solicitud.findMany({
        where: this.buildWhere(filters),
        select: {
          ...CURRENT_ESTADO_INCLUDE,
          sucursalDeseada: {
            select: {
              provincia: { select: { region: { select: { nombre: true } } } },
            },
          },
        },
      }),
      // Source of {nombre, color} per codigo for the chart — replaces the
      // old hardcoded STATUS_COLOR map, so a renamed/recolored estado shows
      // up correctly without a code change.
      this.prisma.estadoSolicitud.findMany({ where: { activo: true } }),
    ]);

    const total = solicitudes.length;
    const activas = solicitudes.filter(
      (s) => currentEstadoCodigo(s) === 'ACTIVA',
    ).length;
    const exitosas = solicitudes.filter(
      (s) => currentEstadoCodigo(s) === 'FINALIZADA',
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

    const byCodigo = new Map<string, number>();
    for (const s of solicitudes) {
      const codigo = currentEstadoCodigo(s);
      byCodigo.set(codigo, (byCodigo.get(codigo) ?? 0) + 1);
    }
    const estadoByCodigo = new Map(estados.map((e) => [e.codigo, e]));
    const statusData = CODIGO_ORDER.filter((codigo) =>
      estadoByCodigo.has(codigo),
    ).map((codigo) => {
      const estado = estadoByCodigo.get(codigo)!;
      return {
        name: estado.nombre,
        value: byCodigo.get(codigo) ?? 0,
        color: estado.color,
      };
    });

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
      include: HC_REQUEST_INCLUDE,
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
        currentEstadoNombre(solicitud),
        solicitud.colaborador.email,
      ]
        .map(csvEscape)
        .join(','),
    );

    return [header, ...rows].join('\n');
  }

  private buildWhere(filters: AnalyticsQueryDto): Prisma.SolicitudWhereInput {
    const where: Prisma.SolicitudWhereInput = { activo: true };
    if (filters.desiredBranchId) {
      where.sucursalDeseadaId = filters.desiredBranchId;
    }
    if (filters.estado) {
      where.historial = {
        some: { fechaFin: null, estado: { codigo: filters.estado } },
      };
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
// `statusCode` rides alongside the display `status` so the frontend can
// look up allowed transitions/colors by the stable codigo without a
// separate estados fetch keyed by the (renamable) nombre.
function toHcRequest(solicitud: SolicitudWithRelations) {
  return {
    id: solicitud.id,
    collaborator: solicitud.colaborador.nombre,
    employeeId: solicitud.colaborador.legajo,
    currentBranch: solicitud.sucursalActual.nombre,
    desiredBranch: solicitud.sucursalDeseada.nombre,
    reason: solicitud.motivo,
    date: formatDateEsAr(solicitud.fechaCreacion),
    status: currentEstadoNombre(solicitud),
    statusCode: currentEstadoCodigo(solicitud),
    email: solicitud.colaborador.email,
  };
}
