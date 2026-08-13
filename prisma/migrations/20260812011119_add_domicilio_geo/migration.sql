-- AlterTable
ALTER TABLE "sucursales" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "domicilios" (
    "id" SERIAL NOT NULL,
    "colabId" TEXT NOT NULL,
    "calle" TEXT,
    "localidad" TEXT,
    "provincia" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "domicilios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domicilios_colabId_key" ON "domicilios"("colabId");

-- AddForeignKey
ALTER TABLE "domicilios" ADD CONSTRAINT "domicilios_colabId_fkey" FOREIGN KEY ("colabId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
