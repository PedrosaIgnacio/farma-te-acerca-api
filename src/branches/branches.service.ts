import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const sucursales = await this.prisma.sucursal.findMany({
      where: {
        activa: true,
        provincia: { activo: true, region: { activo: true } },
      },
      orderBy: { nombre: 'asc' },
      include: { provincia: { include: { region: true } } },
    });

    // Shape matches the frontend's `Branch` type (src/types/index.ts).
    // `zone` is gone — replaced by `provincia`, resolved via the normalized
    // Región→Provincia hierarchy. See DEVIATIONS.md §11. `provinciaId`/
    // `activa` are only really consumed by the HC management screen
    // (HcService.findBranches shares this same `Branch` shape) — included
    // here too so the type stays honest regardless of which endpoint
    // produced a given Branch object; always `activa: true` here since
    // this listing is already filtered to active sucursales.
    return sucursales.map((sucursal) => ({
      id: sucursal.id,
      name: sucursal.nombre,
      region: sucursal.provincia.region.nombre,
      provincia: sucursal.provincia.nombre,
      provinciaId: sucursal.provinciaId,
      activa: sucursal.activa,
      lat: sucursal.lat,
      lng: sucursal.lng,
    }));
  }
}
