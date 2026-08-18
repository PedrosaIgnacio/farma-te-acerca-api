-- DropForeignKey
ALTER TABLE "solicitudes" DROP CONSTRAINT "solicitudes_id_estado_actual_fkey";

-- DropIndex
DROP INDEX "solicitudes_sucursal_deseada_id_estado_actual_idx";

-- DropIndex
DROP INDEX "cambio_estado_solicitud_id_solicitud_idx";

-- AlterTable
ALTER TABLE "solicitudes" DROP COLUMN "id_estado_actual";

-- CreateIndex
CREATE INDEX "solicitudes_sucursal_deseada_idx" ON "solicitudes"("sucursal_deseada");

-- CreateIndex
CREATE INDEX "cambio_estado_solicitud_id_solicitud_fecha_fin_idx" ON "cambio_estado_solicitud"("id_solicitud", "fecha_fin");

-- CreateIndex
CREATE INDEX "cambio_estado_solicitud_id_estado_solicitud_fecha_fin_idx" ON "cambio_estado_solicitud"("id_estado_solicitud", "fecha_fin");
