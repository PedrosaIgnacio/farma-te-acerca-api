-- CreateEnum
CREATE TYPE "Role" AS ENUM ('collaborator', 'hc', 'dt');

-- CreateEnum
CREATE TYPE "ReasonType" AS ENUM ('Mudanza', 'Movilidad', 'Estudios', 'Otro');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('Activa', 'En curso', 'Cancelada', 'Finalizada');

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "legajo" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sucursales" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "zona" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaborador_sucursal" (
    "id" SERIAL NOT NULL,
    "colabId" TEXT NOT NULL,
    "sucursalId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "colaborador_sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes" (
    "id" SERIAL NOT NULL,
    "colabId" TEXT NOT NULL,
    "sucursalActualId" INTEGER NOT NULL,
    "sucursalDeseadaId" INTEGER NOT NULL,
    "reason" "ReasonType" NOT NULL,
    "otherReason" TEXT,
    "description" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "RequestStatus" NOT NULL DEFAULT 'Activa',

    CONSTRAINT "solicitudes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_estado" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "colabId" TEXT NOT NULL,
    "estado" "RequestStatus" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_estado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_legajo_key" ON "profiles"("legajo");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sucursales_nombre_key" ON "sucursales"("nombre");

-- CreateIndex
CREATE INDEX "colaborador_sucursal_colabId_activo_idx" ON "colaborador_sucursal"("colabId", "activo");

-- CreateIndex
CREATE INDEX "solicitudes_sucursalDeseadaId_estado_idx" ON "solicitudes"("sucursalDeseadaId", "estado");

-- CreateIndex
CREATE INDEX "solicitudes_colabId_idx" ON "solicitudes"("colabId");

-- CreateIndex
CREATE INDEX "solicitud_estado_solicitudId_idx" ON "solicitud_estado"("solicitudId");

-- AddForeignKey
ALTER TABLE "colaborador_sucursal" ADD CONSTRAINT "colaborador_sucursal_colabId_fkey" FOREIGN KEY ("colabId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_sucursal" ADD CONSTRAINT "colaborador_sucursal_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_colabId_fkey" FOREIGN KEY ("colabId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_sucursalActualId_fkey" FOREIGN KEY ("sucursalActualId") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_sucursalDeseadaId_fkey" FOREIGN KEY ("sucursalDeseadaId") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_estado" ADD CONSTRAINT "solicitud_estado_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_estado" ADD CONSTRAINT "solicitud_estado_colabId_fkey" FOREIGN KEY ("colabId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
