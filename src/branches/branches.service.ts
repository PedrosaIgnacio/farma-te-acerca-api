import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const sucursales = await this.prisma.sucursal.findMany({
      where: { activa: true },
      orderBy: { nombre: 'asc' },
      include: { provincia: { include: { region: true } } },
    });

    // Shape matches the frontend's `Branch` type (src/types/index.ts).
    // `zone` is gone — replaced by `provincia`, resolved via the normalized
    // Región→Provincia hierarchy. See DEVIATIONS.md §11.
    return sucursales.map((sucursal) => ({
      id: sucursal.id,
      name: sucursal.nombre,
      region: sucursal.provincia.region.nombre,
      provincia: sucursal.provincia.nombre,
    }));
  }
}
