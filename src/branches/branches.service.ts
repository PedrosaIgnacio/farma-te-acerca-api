import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const sucursales = await this.prisma.sucursal.findMany({
      where: { activa: true },
      orderBy: { nombre: 'asc' },
    });

    // Shape matches the frontend's `Branch` type (src/types/index.ts).
    return sucursales.map((sucursal) => ({
      id: sucursal.id,
      name: sucursal.nombre,
      region: sucursal.region,
      zone: sucursal.zona,
    }));
  }
}
