-- CreateEnum
CREATE TYPE "motivo" AS ENUM ('Mudanza', 'Movilidad', 'Estudios', 'Otro');

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estados_solicitud" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "estados_solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regiones" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "regiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provincias" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "id_region" INTEGER NOT NULL,

    CONSTRAINT "provincias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaboradores" (
    "id" TEXT NOT NULL,
    "legajo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,
    "id_rol" INTEGER NOT NULL,

    CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sucursales" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "id_provincia" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colab_domicilios" (
    "id_colab" TEXT NOT NULL,
    "calle" TEXT,
    "localidad" TEXT,
    "id_provincia" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "colab_domicilios_pkey" PRIMARY KEY ("id_colab")
);

-- CreateTable
CREATE TABLE "colab_sucursales" (
    "id" SERIAL NOT NULL,
    "id_colab" TEXT NOT NULL,
    "id_sucursal" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "colab_sucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes" (
    "id" SERIAL NOT NULL,
    "id_colab" TEXT NOT NULL,
    "sucursal_actual" INTEGER NOT NULL,
    "sucursal_deseada" INTEGER NOT NULL,
    "motivo" "motivo" NOT NULL,
    "otro_motivo" TEXT,
    "descripcion" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_estado_actual" INTEGER NOT NULL,

    CONSTRAINT "solicitudes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cambio_estado_solicitud" (
    "id" SERIAL NOT NULL,
    "id_solicitud" INTEGER NOT NULL,
    "id_estado_solicitud" INTEGER NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_fin" TIMESTAMP(3),

    CONSTRAINT "cambio_estado_solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "estados_solicitud_nombre_key" ON "estados_solicitud"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "regiones_nombre_key" ON "regiones"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "provincias_nombre_key" ON "provincias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "colaboradores_legajo_key" ON "colaboradores"("legajo");

-- CreateIndex
CREATE UNIQUE INDEX "colaboradores_email_key" ON "colaboradores"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sucursales_nombre_key" ON "sucursales"("nombre");

-- CreateIndex
CREATE INDEX "colab_sucursales_id_colab_activo_idx" ON "colab_sucursales"("id_colab", "activo");

-- CreateIndex
CREATE INDEX "solicitudes_sucursal_deseada_id_estado_actual_idx" ON "solicitudes"("sucursal_deseada", "id_estado_actual");

-- CreateIndex
CREATE INDEX "solicitudes_id_colab_idx" ON "solicitudes"("id_colab");

-- CreateIndex
CREATE INDEX "cambio_estado_solicitud_id_solicitud_idx" ON "cambio_estado_solicitud"("id_solicitud");

-- AddForeignKey
ALTER TABLE "provincias" ADD CONSTRAINT "provincias_id_region_fkey" FOREIGN KEY ("id_region") REFERENCES "regiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sucursales" ADD CONSTRAINT "sucursales_id_provincia_fkey" FOREIGN KEY ("id_provincia") REFERENCES "provincias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colab_domicilios" ADD CONSTRAINT "colab_domicilios_id_colab_fkey" FOREIGN KEY ("id_colab") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colab_domicilios" ADD CONSTRAINT "colab_domicilios_id_provincia_fkey" FOREIGN KEY ("id_provincia") REFERENCES "provincias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colab_sucursales" ADD CONSTRAINT "colab_sucursales_id_colab_fkey" FOREIGN KEY ("id_colab") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colab_sucursales" ADD CONSTRAINT "colab_sucursales_id_sucursal_fkey" FOREIGN KEY ("id_sucursal") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_id_colab_fkey" FOREIGN KEY ("id_colab") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_sucursal_actual_fkey" FOREIGN KEY ("sucursal_actual") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_sucursal_deseada_fkey" FOREIGN KEY ("sucursal_deseada") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_id_estado_actual_fkey" FOREIGN KEY ("id_estado_actual") REFERENCES "estados_solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambio_estado_solicitud" ADD CONSTRAINT "cambio_estado_solicitud_id_solicitud_fkey" FOREIGN KEY ("id_solicitud") REFERENCES "solicitudes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambio_estado_solicitud" ADD CONSTRAINT "cambio_estado_solicitud_id_estado_solicitud_fkey" FOREIGN KEY ("id_estado_solicitud") REFERENCES "estados_solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
