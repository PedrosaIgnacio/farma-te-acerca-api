import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestStatus } from '../../generated/prisma';
import { formatDateEsAr, toStatusLabel } from '../common/status.util';
import { CreateRequestDto } from './dto/create-request.dto';

const OPEN_STATUSES: RequestStatus[] = ['Activa', 'EnCurso'];

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
        estado: { in: OPEN_STATUSES },
      },
    });
    if (existing) {
      throw new ConflictException({
        message: `Ya tenés una solicitud ${toStatusLabel(existing.estado)} a esta sucursal (N° ${existing.id}). No es posible duplicarla.`,
        existingRequestId: existing.id,
        existingStatus: toStatusLabel(existing.estado),
      });
    }

    const solicitud = await this.prisma.solicitud.create({
      data: {
        colabId,
        sucursalActualId: dto.currentBranchId,
        sucursalDeseadaId: dto.desiredBranchId,
        reason: dto.reason,
        otherReason: dto.reason === 'Otro' ? dto.otherReason : null,
        description: dto.description,
        estado: 'Activa',
        historial: {
          create: { colabId, estado: 'Activa' },
        },
      },
      include: { sucursalDeseada: true },
    });

    return {
      id: solicitud.id,
      branch: solicitud.sucursalDeseada.nombre,
      date: formatDateEsAr(solicitud.fecha),
      status: toStatusLabel(solicitud.estado),
    };
  }

  async findMyHistory(colabId: string) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where: { colabId },
      orderBy: { fecha: 'desc' },
      include: { sucursalDeseada: true },
    });

    return solicitudes.map((solicitud) => ({
      id: solicitud.id,
      branch: solicitud.sucursalDeseada.nombre,
      date: formatDateEsAr(solicitud.fecha),
      status: toStatusLabel(solicitud.estado),
    }));
  }
}
