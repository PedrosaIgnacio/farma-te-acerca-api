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
}
