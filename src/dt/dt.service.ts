import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatDistanceKm, haversineKm } from '../common/geo.util';

@Injectable()
export class DtService {
  constructor(private readonly prisma: PrismaService) {}

  // Distance is from the colaborador's domicilio (home address) to the
  // target sucursal — that's what the case de uso is actually for ("quién
  // vive cerca puede cubrir un turno"), not a proxy via their current branch.
  async findNearby(branchId: number) {
    const targetBranch = await this.prisma.sucursal.findUnique({
      where: { id: branchId },
    });
    if (!targetBranch) {
      throw new NotFoundException('Sucursal inexistente.');
    }
    if (targetBranch.lat === null || targetBranch.lng === null) {
      throw new BadRequestException('Sucursal sin coordenadas cargadas.');
    }
    const target = { lat: targetBranch.lat, lng: targetBranch.lng };

    const candidates = await this.prisma.colaborador.findMany({
      where: {
        rol: { nombre: 'collaborator' },
        activo: true,
        domicilio: { isNot: null },
        sucursales: {
          none: { activo: true, sucursalId: branchId },
        },
      },
      include: {
        domicilio: true,
        sucursales: {
          where: { activo: true },
          include: { sucursal: true },
          take: 1,
        },
      },
    });

    // Shape matches the frontend's `NearbyEmployee` type (src/types/index.ts).
    // `id` is a synthetic ordinal — Colaborador uses a Supabase-managed uuid
    // (see DEVIATIONS.md) but the frontend type expects a number, and this
    // list is display-only (no follow-up fetch by id).
    return candidates
      .map((colaborador) => {
        const domicilio = colaborador.domicilio!;
        const distanceKm = haversineKm(target, {
          lat: domicilio.lat,
          lng: domicilio.lng,
        });
        return {
          name: colaborador.nombre,
          employeeId: colaborador.legajo,
          currentBranch: colaborador.sucursales[0]?.sucursal.nombre ?? '',
          email: colaborador.email,
          distanceKm,
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .map((entry, index) => ({
        id: index + 1,
        name: entry.name,
        employeeId: entry.employeeId,
        currentBranch: entry.currentBranch,
        distance: formatDistanceKm(entry.distanceKm),
        email: entry.email,
      }));
  }
}
