import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CODIGO_ORDER } from '../common/status.util';

export interface EstadoDto {
  codigo: string;
  nombre: string;
  color: string;
}

@Injectable()
export class EstadosService {
  constructor(private readonly prisma: PrismaService) {}

  // Backs the frontend's estado catalog with the DB instead of a hardcoded
  // list: only currently-active estados are returned, so soft-deleting one
  // (`activo = false`) drops it out of the status-change dialog's options
  // on the next fetch, no frontend deploy needed. Order still follows
  // CODIGO_ORDER (the fixed display order) rather than DB insertion order.
  // `codigo` rides along so the frontend can key its own transition/color
  // lookups off the stable business key instead of the renamable `nombre`.
  async findActive(): Promise<EstadoDto[]> {
    const estados = await this.prisma.estadoSolicitud.findMany({
      where: { activo: true },
    });
    const byCodigo = new Map(estados.map((e) => [e.codigo, e]));
    return CODIGO_ORDER.filter((codigo) => byCodigo.has(codigo)).map(
      (codigo) => {
        const estado = byCodigo.get(codigo)!;
        return {
          codigo: estado.codigo,
          nombre: estado.nombre,
          color: estado.color,
        };
      },
    );
  }
}
