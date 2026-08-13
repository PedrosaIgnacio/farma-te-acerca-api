import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '../generated/prisma';

// Same 8 branches the frontend already ships in src/data/mockData.ts
// (BRANCHES) — keeping ids/names/regions/zones aligned means the frontend's
// existing branch strings still resolve once it's wired to this API.
// lat/lng are approximate neighborhood centroids (manually sourced, per the
// "manual entry, no geocoding service" decision) — replace with the exact
// store addresses when those are available.
const BRANCHES = [
  { nombre: 'Farmacity Palermo', region: 'CABA', zona: 'Norte', lat: -34.5875, lng: -58.4205 },
  { nombre: 'Farmacity Belgrano', region: 'CABA', zona: 'Norte', lat: -34.5633, lng: -58.456 },
  {
    nombre: 'Farmacity Rosario Centro',
    region: 'Santa Fe',
    zona: 'Centro',
    lat: -32.9468,
    lng: -60.6393,
  },
  {
    nombre: 'Farmacity Córdoba Nueva Córdoba',
    region: 'Córdoba',
    zona: 'Centro',
    lat: -31.4327,
    lng: -64.1926,
  },
  {
    nombre: 'Farmacity Mendoza Centro',
    region: 'Mendoza',
    zona: 'Cuyo',
    lat: -32.8908,
    lng: -68.8272,
  },
  { nombre: 'Farmacity Salta Centro', region: 'Salta', zona: 'NOA', lat: -24.7859, lng: -65.4117 },
  {
    nombre: 'Farmacity Montevideo Pocitos',
    region: 'Uruguay',
    zona: 'Uruguay',
    lat: -34.9106,
    lng: -56.1548,
  },
  {
    nombre: 'Farmacity Mar del Plata',
    region: 'Buenos Aires',
    zona: 'Costa',
    lat: -38.0055,
    lng: -57.5426,
  },
] as const;

// Local/demo-only accounts so there's something to log in with and click
// through end-to-end — not part of the approved functional spec (real
// colaboradores come from Farmacity's HR system feed, out of scope here).
// Every account shares this password.
const DEMO_PASSWORD = 'Demo1234!';
// `domicilio` (a few km from the assigned branch, for a believable DT
// "colaboradores cercanos" demo) is only set for `collaborator`-role
// accounts — matches DtService.findNearby's `role: 'collaborator'` filter,
// since HC/DT accounts shouldn't show up as contingency coverage candidates.
// calle/localidad/provincia were reverse-geocoded once from lat/lng via
// Nominatim (OpenStreetMap) and hardcoded here so the seed stays
// self-contained — no geocoding call happens at seed time.
const DEMO_PROFILES = [
  {
    legajo: '10001',
    fullName: 'Colaborador Demo',
    role: 'collaborator' as const,
    email: 'colaborador.demo@farmacity.com',
    branch: 'Farmacity Palermo',
    domicilio: {
      lat: -34.575,
      lng: -58.43,
      calle: 'Avenida Luis María Campos 131',
      localidad: 'Buenos Aires',
      provincia: 'Ciudad Autónoma de Buenos Aires',
    },
  },
  {
    legajo: '10002',
    fullName: 'Capital Humano Demo',
    role: 'hc' as const,
    email: 'hc.demo@farmacity.com',
    branch: 'Farmacity Palermo',
    domicilio: null,
  },
  {
    legajo: '10003',
    fullName: 'DT Demo',
    role: 'dt' as const,
    email: 'dt.demo@farmacity.com',
    branch: 'Farmacity Palermo',
    domicilio: null,
  },
  {
    legajo: '10004',
    fullName: 'Martina Suárez',
    role: 'collaborator' as const,
    email: 'martina.suarez@farmacity.com',
    branch: 'Farmacity Belgrano',
    domicilio: {
      lat: -34.572,
      lng: -58.445,
      calle: 'Ciudad de la Paz 609',
      localidad: 'Buenos Aires',
      provincia: 'Ciudad Autónoma de Buenos Aires',
    },
  },
  {
    legajo: '10005',
    fullName: 'Diego Ramallo',
    role: 'collaborator' as const,
    email: 'diego.ramallo@farmacity.com',
    branch: 'Farmacity Rosario Centro',
    domicilio: {
      lat: -32.96,
      lng: -60.65,
      calle: 'España 2065',
      localidad: 'Rosario',
      provincia: 'Santa Fe',
    },
  },
  // 10006+ round out the collaborator pool to ~20 across all 8 sucursales
  // (including Uruguay) so HC/DT screens have realistic volume to demo.
  {
    legajo: '10006',
    fullName: 'Sofía Martínez',
    role: 'collaborator' as const,
    email: 'sofia.martinez@farmacity.com',
    branch: 'Farmacity Palermo',
    domicilio: {
      lat: -34.595,
      lng: -58.415,
      calle: 'Mario Bravo 1254',
      localidad: 'Buenos Aires',
      provincia: 'Ciudad Autónoma de Buenos Aires',
    },
  },
  {
    legajo: '10007',
    fullName: 'Tomás Fernández',
    role: 'collaborator' as const,
    email: 'tomas.fernandez@farmacity.com',
    branch: 'Farmacity Palermo',
    domicilio: {
      lat: -34.6,
      lng: -58.44,
      calle: 'Avenida Raúl Scalabrini Ortiz 210',
      localidad: 'Buenos Aires',
      provincia: 'Ciudad Autónoma de Buenos Aires',
    },
  },
  {
    legajo: '10008',
    fullName: 'Valentina López',
    role: 'collaborator' as const,
    email: 'valentina.lopez@farmacity.com',
    branch: 'Farmacity Belgrano',
    domicilio: {
      lat: -34.55,
      lng: -58.46,
      calle: 'Guayra 1927',
      localidad: 'Buenos Aires',
      provincia: 'Ciudad Autónoma de Buenos Aires',
    },
  },
  {
    legajo: '10009',
    fullName: 'Agustín Díaz',
    role: 'collaborator' as const,
    email: 'agustin.diaz@farmacity.com',
    branch: 'Farmacity Belgrano',
    domicilio: {
      lat: -34.57,
      lng: -58.47,
      calle: 'Juramento 3770',
      localidad: 'Buenos Aires',
      provincia: 'Ciudad Autónoma de Buenos Aires',
    },
  },
  {
    legajo: '10010',
    fullName: 'Camila Torres',
    role: 'collaborator' as const,
    email: 'camila.torres@farmacity.com',
    branch: 'Farmacity Rosario Centro',
    // Original -32.93,-60.63 fell in the Paraná river with no reverse-geocode
    // match; nudged ~1.5km to a real Rosario Centro address.
    domicilio: {
      lat: -32.94,
      lng: -60.645,
      calle: 'Tucumán 1700',
      localidad: 'Rosario',
      provincia: 'Santa Fe',
    },
  },
  {
    legajo: '10011',
    fullName: 'Franco Romero',
    role: 'collaborator' as const,
    email: 'franco.romero@farmacity.com',
    branch: 'Farmacity Rosario Centro',
    domicilio: {
      lat: -32.96,
      lng: -60.66,
      calle: 'Avenida Dante Alighieri',
      localidad: 'Rosario',
      provincia: 'Santa Fe',
    },
  },
  {
    legajo: '10012',
    fullName: 'Julieta Sosa',
    role: 'collaborator' as const,
    email: 'julieta.sosa@farmacity.com',
    branch: 'Farmacity Córdoba Nueva Córdoba',
    domicilio: {
      lat: -31.42,
      lng: -64.18,
      calle: 'Obispo Salguero 220',
      localidad: 'Córdoba',
      provincia: 'Córdoba',
    },
  },
  {
    legajo: '10013',
    fullName: 'Matías Herrera',
    role: 'collaborator' as const,
    email: 'matias.herrera@farmacity.com',
    branch: 'Farmacity Córdoba Nueva Córdoba',
    domicilio: {
      lat: -31.45,
      lng: -64.2,
      calle: 'Avenida Vélez Sarsfield 3450',
      localidad: 'Córdoba',
      provincia: 'Córdoba',
    },
  },
  {
    legajo: '10014',
    fullName: 'Lucía Acosta',
    role: 'collaborator' as const,
    email: 'lucia.acosta@farmacity.com',
    branch: 'Farmacity Córdoba Nueva Córdoba',
    domicilio: {
      lat: -31.44,
      lng: -64.21,
      calle: 'Rafael de Igarzabal 1217',
      localidad: 'Córdoba',
      provincia: 'Córdoba',
    },
  },
  {
    legajo: '10015',
    fullName: 'Nicolás Molina',
    role: 'collaborator' as const,
    email: 'nicolas.molina@farmacity.com',
    branch: 'Farmacity Mendoza Centro',
    domicilio: {
      lat: -32.88,
      lng: -68.83,
      calle: 'Juan Bautista Alberdi 472',
      localidad: 'Ciudad de Mendoza',
      provincia: 'Mendoza',
    },
  },
  {
    legajo: '10016',
    fullName: 'Florencia Rojas',
    role: 'collaborator' as const,
    email: 'florencia.rojas@farmacity.com',
    branch: 'Farmacity Mendoza Centro',
    domicilio: {
      lat: -32.9,
      lng: -68.85,
      calle: 'Isabel la Católica 370',
      localidad: 'Ciudad de Mendoza',
      provincia: 'Mendoza',
    },
  },
  {
    legajo: '10017',
    fullName: 'Bruno Castro',
    role: 'collaborator' as const,
    email: 'bruno.castro@farmacity.com',
    branch: 'Farmacity Salta Centro',
    domicilio: {
      lat: -24.78,
      lng: -65.42,
      calle: 'Almirante Guillermo Brown 1303',
      localidad: 'Salta',
      provincia: 'Salta',
    },
  },
  {
    legajo: '10018',
    fullName: 'Milagros Vega',
    role: 'collaborator' as const,
    email: 'milagros.vega@farmacity.com',
    branch: 'Farmacity Salta Centro',
    domicilio: {
      lat: -24.79,
      lng: -65.4,
      calle: 'Indalecio Gómez',
      localidad: 'Salta',
      provincia: 'Salta',
    },
  },
  {
    legajo: '10019',
    fullName: 'Rodrigo Ibáñez',
    role: 'collaborator' as const,
    email: 'rodrigo.ibanez@farmacity.com',
    branch: 'Farmacity Montevideo Pocitos',
    domicilio: {
      lat: -34.91,
      lng: -56.16,
      calle: 'El Viejo Pancho 2473',
      localidad: 'Montevideo',
      provincia: 'Montevideo',
    },
  },
  {
    legajo: '10020',
    fullName: 'Antonella Ferreira',
    role: 'collaborator' as const,
    email: 'antonella.ferreira@farmacity.com',
    branch: 'Farmacity Montevideo Pocitos',
    domicilio: {
      lat: -34.9,
      lng: -56.14,
      calle: 'Marco Bruto 1454',
      localidad: 'Montevideo',
      provincia: 'Montevideo',
    },
  },
  {
    legajo: '10021',
    fullName: 'Emiliano Paz',
    role: 'collaborator' as const,
    email: 'emiliano.paz@farmacity.com',
    branch: 'Farmacity Mar del Plata',
    domicilio: {
      lat: -38.0,
      lng: -57.55,
      calle: 'Belgrano 2793',
      localidad: 'Mar del Plata',
      provincia: 'Buenos Aires',
    },
  },
  {
    legajo: '10022',
    fullName: 'Catalina Núñez',
    role: 'collaborator' as const,
    email: 'catalina.nunez@farmacity.com',
    branch: 'Farmacity Mar del Plata',
    domicilio: {
      lat: -38.02,
      lng: -57.53,
      calle: 'Leandro N. Alem 2767',
      localidad: 'Mar del Plata',
      provincia: 'Buenos Aires',
    },
  },
  {
    legajo: '10023',
    fullName: 'Ignacio Pedrosa',
    role: 'collaborator' as const,
    email: 'ipedrosa.dev@gmail.com',
    branch: 'Farmacity Palermo',
    domicilio: {
      lat: -34.58,
      lng: -58.42,
      calle: 'Avenida Presidente Sarmiento 2656',
      localidad: 'Buenos Aires',
      provincia: 'Ciudad Autónoma de Buenos Aires',
    },
  },
] as const;

// 20 demo solicitudes, spread across colaboradores/sucursales/estados/dates so
// HC's list + analytics (KPIs, region/status breakdown, CSV export) have
// realistic variety to demo instead of a single test row. `daysAgo` gives
// `from`/`to` date-range filters something to actually filter.
const SOLICITUDES_DEMO = [
  { legajo: '10001', sucursalDeseada: 'Farmacity Mar del Plata', reason: 'Mudanza' as const, otherReason: undefined, estado: 'Finalizada' as const, daysAgo: 60 },
  { legajo: '10004', sucursalDeseada: 'Farmacity Palermo', reason: 'Movilidad' as const, otherReason: undefined, estado: 'Activa' as const, daysAgo: 5 },
  { legajo: '10005', sucursalDeseada: 'Farmacity Córdoba Nueva Córdoba', reason: 'Estudios' as const, otherReason: undefined, estado: 'EnCurso' as const, daysAgo: 15 },
  { legajo: '10006', sucursalDeseada: 'Farmacity Belgrano', reason: 'Movilidad' as const, otherReason: undefined, estado: 'Cancelada' as const, daysAgo: 40 },
  { legajo: '10007', sucursalDeseada: 'Farmacity Mendoza Centro', reason: 'Mudanza' as const, otherReason: undefined, estado: 'Activa' as const, daysAgo: 3 },
  { legajo: '10008', sucursalDeseada: 'Farmacity Salta Centro', reason: 'Otro' as const, otherReason: 'Cuidado familiar', estado: 'EnCurso' as const, daysAgo: 20 },
  { legajo: '10009', sucursalDeseada: 'Farmacity Palermo', reason: 'Estudios' as const, otherReason: undefined, estado: 'Finalizada' as const, daysAgo: 90 },
  { legajo: '10010', sucursalDeseada: 'Farmacity Mar del Plata', reason: 'Movilidad' as const, otherReason: undefined, estado: 'Activa' as const, daysAgo: 2 },
  { legajo: '10011', sucursalDeseada: 'Farmacity Belgrano', reason: 'Mudanza' as const, otherReason: undefined, estado: 'Cancelada' as const, daysAgo: 35 },
  { legajo: '10012', sucursalDeseada: 'Farmacity Mendoza Centro', reason: 'Estudios' as const, otherReason: undefined, estado: 'EnCurso' as const, daysAgo: 10 },
  { legajo: '10013', sucursalDeseada: 'Farmacity Salta Centro', reason: 'Movilidad' as const, otherReason: undefined, estado: 'Finalizada' as const, daysAgo: 70 },
  { legajo: '10014', sucursalDeseada: 'Farmacity Rosario Centro', reason: 'Mudanza' as const, otherReason: undefined, estado: 'Activa' as const, daysAgo: 8 },
  { legajo: '10015', sucursalDeseada: 'Farmacity Córdoba Nueva Córdoba', reason: 'Otro' as const, otherReason: 'Reagrupamiento familiar', estado: 'Cancelada' as const, daysAgo: 25 },
  { legajo: '10016', sucursalDeseada: 'Farmacity Salta Centro', reason: 'Estudios' as const, otherReason: undefined, estado: 'Activa' as const, daysAgo: 1 },
  { legajo: '10017', sucursalDeseada: 'Farmacity Mendoza Centro', reason: 'Movilidad' as const, otherReason: undefined, estado: 'EnCurso' as const, daysAgo: 12 },
  { legajo: '10018', sucursalDeseada: 'Farmacity Córdoba Nueva Córdoba', reason: 'Mudanza' as const, otherReason: undefined, estado: 'Finalizada' as const, daysAgo: 100 },
  { legajo: '10019', sucursalDeseada: 'Farmacity Mar del Plata', reason: 'Movilidad' as const, otherReason: undefined, estado: 'Activa' as const, daysAgo: 4 },
  { legajo: '10020', sucursalDeseada: 'Farmacity Palermo', reason: 'Estudios' as const, otherReason: undefined, estado: 'EnCurso' as const, daysAgo: 18 },
  { legajo: '10021', sucursalDeseada: 'Farmacity Montevideo Pocitos', reason: 'Mudanza' as const, otherReason: undefined, estado: 'Finalizada' as const, daysAgo: 50 },
  { legajo: '10022', sucursalDeseada: 'Farmacity Rosario Centro', reason: 'Otro' as const, otherReason: 'Motivos personales', estado: 'Cancelada' as const, daysAgo: 30 },
] as const;

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  for (const branch of BRANCHES) {
    await prisma.sucursal.upsert({
      where: { nombre: branch.nombre },
      update: { region: branch.region, zona: branch.zona, lat: branch.lat, lng: branch.lng },
      create: branch,
    });
  }
  console.log(`Seeded ${BRANCHES.length} sucursales.`);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.log('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — skipping demo colaboradores.');
    await prisma.$disconnect();
    return;
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Defined as a closure (rather than a top-level function taking the client
  // as a parameter) to sidestep a `@supabase/supabase-js` typing quirk where
  // re-annotating `SupabaseClient` at a function boundary produces a
  // structurally incompatible generic instantiation.
  async function getOrCreateAuthUser(email: string, password: string): Promise<string> {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (!error && created.user) {
      return created.user.id;
    }

    // Already exists — page through admin.listUsers to find it (no
    // getUserByEmail in the admin API).
    for (let page = 1; page <= 10; page++) {
      const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (listError) break;
      const match = data.users.find((user) => user.email === email);
      if (match) return match.id;
      if (data.users.length < 200) break;
    }
    throw new Error(`Could not create or find Supabase auth user for ${email}`);
  }

  for (const demo of DEMO_PROFILES) {
    const authUserId = await getOrCreateAuthUser(demo.email, DEMO_PASSWORD);
    const branch = await prisma.sucursal.findUniqueOrThrow({ where: { nombre: demo.branch } });

    const profile = await prisma.profile.upsert({
      where: { legajo: demo.legajo },
      update: { fullName: demo.fullName, role: demo.role, email: demo.email },
      create: {
        id: authUserId,
        legajo: demo.legajo,
        fullName: demo.fullName,
        role: demo.role,
        email: demo.email,
      },
    });

    const existingAssignment = await prisma.colaboradorSucursal.findFirst({
      where: { colabId: profile.id, activo: true },
    });
    if (!existingAssignment) {
      await prisma.colaboradorSucursal.create({
        data: { colabId: profile.id, sucursalId: branch.id, activo: true },
      });
    }

    if (demo.domicilio) {
      await prisma.domicilio.upsert({
        where: { colabId: profile.id },
        update: demo.domicilio,
        create: { colabId: profile.id, ...demo.domicilio },
      });
    }
  }
  console.log(`Seeded ${DEMO_PROFILES.length} colaboradores demo (password: ${DEMO_PASSWORD}).`);

  let solicitudesCreated = 0;
  for (const demo of SOLICITUDES_DEMO) {
    const colaborador = await prisma.profile.findUniqueOrThrow({ where: { legajo: demo.legajo } });
    const asignacionActual = await prisma.colaboradorSucursal.findFirstOrThrow({
      where: { colabId: colaborador.id, activo: true },
    });
    const sucursalDeseada = await prisma.sucursal.findUniqueOrThrow({
      where: { nombre: demo.sucursalDeseada },
    });

    const yaExiste = await prisma.solicitud.findFirst({
      where: { colabId: colaborador.id, sucursalDeseadaId: sucursalDeseada.id },
    });
    if (yaExiste) continue;

    const fecha = new Date(Date.now() - demo.daysAgo * 24 * 60 * 60 * 1000);
    await prisma.solicitud.create({
      data: {
        colabId: colaborador.id,
        sucursalActualId: asignacionActual.sucursalId,
        sucursalDeseadaId: sucursalDeseada.id,
        reason: demo.reason,
        otherReason: demo.otherReason,
        fecha,
        estado: demo.estado,
        historial: { create: { colabId: colaborador.id, estado: demo.estado, fecha } },
      },
    });
    solicitudesCreated++;
  }
  console.log(`Seeded ${solicitudesCreated} solicitudes demo (${SOLICITUDES_DEMO.length - solicitudesCreated} already existed).`);

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
