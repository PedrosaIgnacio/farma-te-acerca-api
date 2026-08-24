import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  OPEN_STATUSES,
  CURRENT_ESTADO_INCLUDE,
  currentEstadoNombre,
  formatDateEsAr,
  formatDateTimeEsAr,
} from '../common/status.util';
import { CreateRequestDto } from './dto/create-request.dto';

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(colabId: string, dto: CreateRequestDto) {
    const [currentBranch, desiredBranch] = await Promise.all([
      this.prisma.sucursal.findUnique({ where: { id: dto.currentBranchId } }),
      this.prisma.sucursal.findUnique({ where: { id: dto.desiredBranchId } }),
    ]);
    if (!currentBranch || !desiredBranch) {
      throw new NotFoundException('Sucursal inexistente.');
    }

    const existing = await this.prisma.solicitud.findFirst({
      where: {
        colabId,
        sucursalDeseadaId: dto.desiredBranchId,
        historial: {
          some: { fechaFin: null, estado: { nombre: { in: OPEN_STATUSES } } },
        },
      },
      include: CURRENT_ESTADO_INCLUDE,
    });
    if (existing) {
      const existingStatus = currentEstadoNombre(existing);
      throw new ConflictException({
        message: `Ya tenés una solicitud ${existingStatus} a esta sucursal (N° ${existing.id}). No es posible duplicarla.`,
        existingRequestId: existing.id,
        existingStatus,
      });
    }

    const estadoActivo = await this.prisma.estadoSolicitud.findUniqueOrThrow({
      where: { nombre: 'Activa' },
    });

    const solicitud = await this.prisma.solicitud.create({
      data: {
        colabId,
        sucursalActualId: dto.currentBranchId,
        sucursalDeseadaId: dto.desiredBranchId,
        motivo: dto.reason,
        otroMotivo: dto.reason === 'Otro' ? dto.otherReason : null,
        descripcion: dto.description,
        historial: {
          create: { estadoId: estadoActivo.id },
        },
      },
      include: { sucursalDeseada: true, ...CURRENT_ESTADO_INCLUDE },
    });

    return {
      id: solicitud.id,
      branch: solicitud.sucursalDeseada.nombre,
      date: formatDateEsAr(solicitud.fechaCreacion),
      status: currentEstadoNombre(solicitud),
    };
  }

  async findMyHistory(colabId: string) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where: { colabId },
      orderBy: { fechaCreacion: 'desc' },
      include: { sucursalDeseada: true, ...CURRENT_ESTADO_INCLUDE },
    });

    return solicitudes.map((solicitud) => ({
      id: solicitud.id,
      branch: solicitud.sucursalDeseada.nombre,
      date: formatDateEsAr(solicitud.fechaCreacion),
      status: currentEstadoNombre(solicitud),
    }));
  }

  // `where: { id, colabId }` (rather than `findUnique` on id alone) scopes
  // the lookup to the caller's own solicitudes in one query — a solicitud
  // belonging to someone else 404s the same as one that doesn't exist, so
  // this never leaks whether a given id exists to another collaborator.
  async findOne(colabId: string, id: number) {
    const solicitud = await this.prisma.solicitud.findFirst({
      where: { id, colabId },
      include: {
        sucursalActual: true,
        sucursalDeseada: true,
        historial: {
          orderBy: { fechaInicio: 'asc' },
          include: { estado: true },
        },
      },
    });
    if (!solicitud) {
      throw new NotFoundException('Solicitud inexistente.');
    }

    const current = solicitud.historial.find((h) => h.fechaFin === null);
    if (!current) {
      throw new Error('Solicitud sin estado vigente (historial vacío).');
    }

    return {
      id: solicitud.id,
      currentBranch: solicitud.sucursalActual.nombre,
      desiredBranch: solicitud.sucursalDeseada.nombre,
      reason: solicitud.motivo,
      otherReason: solicitud.otroMotivo,
      description: solicitud.descripcion,
      date: formatDateEsAr(solicitud.fechaCreacion),
      status: current.estado.nombre,
      history: solicitud.historial.map((h) => ({
        status: h.estado.nombre,
        startDate: formatDateTimeEsAr(h.fechaInicio),
        endDate: h.fechaFin ? formatDateTimeEsAr(h.fechaFin) : null,
        motivo: h.motivo,
      })),
    };
  }
}
