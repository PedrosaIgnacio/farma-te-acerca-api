-- Add nullable first: existing rows have no value yet, backfill below,
-- then tighten to NOT NULL/UNIQUE once every row has one.
ALTER TABLE "estados_solicitud" ADD COLUMN "codigo" TEXT;
ALTER TABLE "estados_solicitud" ADD COLUMN "color" TEXT;

-- Backfill the 6 fixed estados (see status.util.ts ESTADO_CODIGOS/CODIGO_ORDER
-- and the removed STATUS_COLOR map for the source values).
UPDATE "estados_solicitud" SET "codigo" = 'ACTIVA', "color" = '#0284C7' WHERE "nombre" = 'Activa';
UPDATE "estados_solicitud" SET "codigo" = 'EN_CURSO', "color" = '#D97706' WHERE "nombre" = 'En curso';
UPDATE "estados_solicitud" SET "codigo" = 'APROBADO', "color" = '#7C3AED' WHERE "nombre" = 'Aprobado';
UPDATE "estados_solicitud" SET "codigo" = 'NO_APROBADO', "color" = '#DC2626' WHERE "nombre" = 'No aprobado';
UPDATE "estados_solicitud" SET "codigo" = 'FINALIZADA', "color" = '#1F7A4D' WHERE "nombre" = 'Finalizada';
UPDATE "estados_solicitud" SET "codigo" = 'CANCELADA', "color" = '#78716C' WHERE "nombre" = 'Cancelada';

-- AlterTable: tighten now that every row is backfilled.
ALTER TABLE "estados_solicitud" ALTER COLUMN "codigo" SET NOT NULL;
ALTER TABLE "estados_solicitud" ALTER COLUMN "color" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "estados_solicitud_codigo_key" ON "estados_solicitud"("codigo");
