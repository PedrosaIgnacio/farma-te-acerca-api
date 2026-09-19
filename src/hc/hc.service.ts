import { randomBytes } from 'crypto';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
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
import { CreateHcUserDto } from './dto/create-hc-user.dto';
import { CreateSucursalDto } from './dto/create-sucursal.dto';
import { HcRequestsQueryDto } from './dto/hc-requests-query.dto';
import { UpdateHcUserDto } from './dto/update-hc-user.dto';
import { UpdateSucursalDto } from './dto/update-sucursal.dto';

// Bucket for solicitudes whose colaborador has no descripcion_puesto set —
// shared between the analytics breakdown and the CSV export.
const PUESTO_FALLBACK = 'Sin puesto asignado';

const HC_REQUEST_INCLUDE = {
  colaborador: true,
  sucursalActual: true,
  sucursalDeseada: true,
  ...CURRENT_ESTADO_INCLUDE,
} satisfies Prisma.SolicitudInclude;

type SolicitudWithRelations = Prisma.SolicitudGetPayload<{
  include: typeof HC_REQUEST_INCLUDE;
}>;

const SUCURSAL_INCLUDE = {
  provincia: { include: { region: true } },
} satisfies Prisma.SucursalInclude;

type SucursalWithRelations = Prisma.SucursalGetPayload<{
  include: typeof SUCURSAL_INCLUDE;
}>;

const HC_USER_INCLUDE = {
  rol: true,
  sucursales: {
    where: { activo: true },
    include: { sucursal: true },
    take: 1,
  },
} satisfies Prisma.ColaboradorInclude;

type ColaboradorWithRelations = Prisma.ColaboradorGetPayload<{
  include: typeof HC_USER_INCLUDE;
}>;

@Injectable()
export class HcService {
  private readonly logger = new Logger(HcService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestsService: RequestsService,
    private readonly supabase: SupabaseService,
    private readonly mailService: MailService,
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

  // Management listing for the Sucursales ABM — unlike BranchesService.findAll
  // (public, active-only, used by branch pickers), this returns every
  // sucursal regardless of `activa` so HC can find and reactivate one.
  async findBranches() {
    const sucursales = await this.prisma.sucursal.findMany({
      orderBy: { nombre: 'asc' },
      include: SUCURSAL_INCLUDE,
    });
    return sucursales.map(toSucursalDto);
  }

  async createBranch(dto: CreateSucursalDto) {
    await this.assertProvinciaExists(dto.provinciaId);
    await this.assertSucursalNombreAvailable(dto.nombre);

    const sucursal = await this.prisma.sucursal.create({
      data: {
        nombre: dto.nombre,
        provinciaId: dto.provinciaId,
        lat: dto.lat,
        lng: dto.lng,
      },
      include: SUCURSAL_INCLUDE,
    });
    return toSucursalDto(sucursal);
  }

  async updateBranch(id: number, dto: UpdateSucursalDto) {
    const existing = await this.prisma.sucursal.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Sucursal inexistente.');
    }
    if (dto.provinciaId !== undefined) {
      await this.assertProvinciaExists(dto.provinciaId);
    }
    if (dto.nombre !== undefined && dto.nombre !== existing.nombre) {
      await this.assertSucursalNombreAvailable(dto.nombre);
    }

    const sucursal = await this.prisma.sucursal.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        provinciaId: dto.provinciaId,
        lat: dto.lat,
        lng: dto.lng,
        activa: dto.activa,
      },
      include: SUCURSAL_INCLUDE,
    });
    return toSucursalDto(sucursal);
  }

  // Lookup for the Sucursal form's provincia Select — nothing else currently
  // exposes the Provincia catalog to the frontend (it only ever appears
  // flattened as a string on Branch.provincia/Branch.region).
  async findProvincias() {
    const provincias = await this.prisma.provincia.findMany({
      where: { activo: true, region: { activo: true } },
      orderBy: { nombre: 'asc' },
      include: { region: true },
    });
    return provincias.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      region: { id: p.region.id, nombre: p.region.nombre },
    }));
  }

  private async assertProvinciaExists(provinciaId: number) {
    const provincia = await this.prisma.provincia.findUnique({
      where: { id: provinciaId },
    });
    if (!provincia) {
      throw new NotFoundException('Provincia inexistente.');
    }
  }

  private async assertSucursalExists(sucursalId: number) {
    const sucursal = await this.prisma.sucursal.findUnique({
      where: { id: sucursalId },
    });
    if (!sucursal) {
      throw new NotFoundException('Sucursal inexistente.');
    }
  }

  private async assertSucursalNombreAvailable(nombre: string) {
    const existing = await this.prisma.sucursal.findUnique({
      where: { nombre },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe una sucursal con nombre "${nombre}".`,
      );
    }
  }

  async findUsers() {
    const colaboradores = await this.prisma.colaborador.findMany({
      orderBy: { nombre: 'asc' },
      include: HC_USER_INCLUDE,
    });
    return colaboradores.map(toHcUserDto);
  }

  private async assertLegajoAvailable(legajo: string) {
    const existing = await this.prisma.colaborador.findUnique({
      where: { legajo },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un colaborador con legajo "${legajo}".`,
      );
    }
  }

  private async assertEmailAvailable(email: string) {
    const existing = await this.prisma.colaborador.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un colaborador con email "${email}".`,
      );
    }
  }

  // Creates both the Colaborador row and its Supabase Auth account. A
  // temporary password is generated here and returned once in the response
  // — there's no invite-email flow, HC relays it to the person out-of-band.
  async createUser(dto: CreateHcUserDto) {
    await this.assertLegajoAvailable(dto.legajo);
    await this.assertEmailAvailable(dto.email);
    if (dto.sucursalId !== undefined) {
      await this.assertSucursalExists(dto.sucursalId);
    }

    const temporaryPassword = randomBytes(9).toString('base64url');
    const { data, error } = await this.supabase.admin.auth.admin.createUser({
      email: dto.email,
      password: temporaryPassword,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new ConflictException(
        error?.message ?? 'No se pudo crear la cuenta de acceso.',
      );
    }

    try {
      const colaborador = await this.prisma.colaborador.create({
        data: {
          id: data.user.id,
          legajo: dto.legajo,
          nombre: dto.nombre,
          email: dto.email,
          telefono: dto.telefono,
          rol: { connect: { nombre: dto.rol } },
          ...(dto.sucursalId !== undefined
            ? { sucursales: { create: { sucursalId: dto.sucursalId } } }
            : {}),
        },
        include: HC_USER_INCLUDE,
      });
      return { ...toHcUserDto(colaborador), temporaryPassword };
    } catch (err) {
      await this.supabase.admin.auth.admin.deleteUser(data.user.id);
      throw err;
    }
  }

  async updateUser(id: string, dto: UpdateHcUserDto) {
    const colaborador = await this.prisma.colaborador.findUnique({
      where: { id },
      include: { sucursales: { where: { activo: true }, take: 1 } },
    });
    if (!colaborador) {
      throw new NotFoundException('Colaborador inexistente.');
    }

    if (dto.email !== undefined && dto.email !== colaborador.email) {
      await this.assertEmailAvailable(dto.email);
      const { error } = await this.supabase.admin.auth.admin.updateUserById(
        id,
        { email: dto.email },
      );
      if (error) {
        throw new ConflictException(error.message);
      }
    }

    if (dto.sucursalId !== undefined) {
      await this.assertSucursalExists(dto.sucursalId);
      const current = colaborador.sucursales[0];
      if (!current || current.sucursalId !== dto.sucursalId) {
        await this.prisma.$transaction([
          ...(current
            ? [
                this.prisma.colabSucursal.update({
                  where: { id: current.id },
                  data: { activo: false },
                }),
              ]
            : []),
          this.prisma.colabSucursal.create({
            data: { colabId: id, sucursalId: dto.sucursalId, activo: true },
          }),
        ]);
      }
    }

    const updated = await this.prisma.colaborador.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        email: dto.email,
        telefono: dto.telefono,
        activo: dto.activo,
        ...(dto.rol !== undefined
          ? { rol: { connect: { nombre: dto.rol } } }
          : {}),
      },
      include: HC_USER_INCLUDE,
    });
    return toHcUserDto(updated);
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

    try {
      await this.mailService.sendSolicitudStatusChanged({
        to: updated.colaborador.email,
        colaboradorNombre: updated.colaborador.nombre,
        codigo,
        estadoNombre: nuevoEstado.nombre,
        sucursalActual: updated.sucursalActual.nombre,
        sucursalDeseada: updated.sucursalDeseada.nombre,
        motivo,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send status-change email for solicitud ${id}`,
        err instanceof Error ? err.stack : err,
      );
    }

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
          colaborador: { select: { descripcionPuesto: true } },
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

    const byPuesto = new Map<string, number>();
    for (const s of solicitudes) {
      const puesto = s.colaborador.descripcionPuesto ?? PUESTO_FALLBACK;
      byPuesto.set(puesto, (byPuesto.get(puesto) ?? 0) + 1);
    }
    const puestoData = [...byPuesto.entries()]
      .map(([puesto, requests]) => ({ puesto, requests }))
      .sort((a, b) => b.requests - a.requests);

    return {
      kpis: {
        totalSolicitudes: total,
        activas,
        exitosas,
        successRate: `${successRate}%`,
      },
      regionData,
      statusData,
      puestoData,
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
      'puesto',
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
        solicitud.colaborador.descripcionPuesto ?? PUESTO_FALLBACK,
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

// Shape matches the frontend's `Branch` type plus `activa`/`provinciaId`,
// which the public BranchesService.findAll's Branch shape omits — those
// two only matter to the management screen (toggling activa, editing
// provincia), not to the read-only branch pickers used elsewhere.
function toSucursalDto(sucursal: SucursalWithRelations) {
  return {
    id: sucursal.id,
    name: sucursal.nombre,
    provinciaId: sucursal.provinciaId,
    provincia: sucursal.provincia.nombre,
    region: sucursal.provincia.region.nombre,
    activa: sucursal.activa,
    lat: sucursal.lat,
    lng: sucursal.lng,
  };
}

// Shape matches the frontend's `HcUser` type — distinct from the narrower
// `HcCollaborator` shape `findCollaborators` above returns (which stays
// scoped to active `collaborator`-role people for the "solicitar en nombre
// de" select).
function toHcUserDto(colaborador: ColaboradorWithRelations) {
  return {
    id: colaborador.id,
    legajo: colaborador.legajo,
    nombre: colaborador.nombre,
    email: colaborador.email,
    telefono: colaborador.telefono,
    rol: colaborador.rol.nombre,
    activo: colaborador.activo,
    currentBranchId: colaborador.sucursales[0]?.sucursal.id ?? null,
    currentBranch: colaborador.sucursales[0]?.sucursal.nombre ?? null,
  };
}
