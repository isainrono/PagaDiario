-- CreateEnum
CREATE TYPE "EstadoPartida" AS ENUM ('ESPERANDO', 'EN_CURSO', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "ModoMonetario" AS ENUM ('DIGITAL', 'FISICO', 'HIBRIDO');

-- CreateEnum
CREATE TYPE "Ficha" AS ENUM ('PERRO', 'SOMBRERO', 'COCHE', 'BARCO', 'DEDAL', 'CARRETILLA', 'CABALLO', 'PLANCHA');

-- CreateEnum
CREATE TYPE "TipoTransaccion" AS ENUM ('SALARIO', 'ALQUILER', 'COMPRA', 'IMPUESTO', 'CARTA', 'HIPOTECA', 'CONSTRUCCION', 'SUBASTA', 'NEGOCIACION', 'BANCARROTA');

-- CreateTable
CREATE TABLE "Partida" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "estado" "EstadoPartida" NOT NULL DEFAULT 'ESPERANDO',
    "modoMonetario" "ModoMonetario" NOT NULL DEFAULT 'DIGITAL',
    "turnoActual" INTEGER NOT NULL DEFAULT 0,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jugador" (
    "id" TEXT NOT NULL,
    "partidaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ficha" "Ficha" NOT NULL,
    "posicion" INTEGER NOT NULL DEFAULT 0,
    "saldo" INTEGER NOT NULL DEFAULT 1500,
    "enCarcel" BOOLEAN NOT NULL DEFAULT false,
    "turnosEnCarcel" INTEGER NOT NULL DEFAULT 0,
    "cartaSalida" BOOLEAN NOT NULL DEFAULT false,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "ordenTurno" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Jugador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Propiedad" (
    "id" TEXT NOT NULL,
    "partidaId" TEXT NOT NULL,
    "propietarioId" TEXT,
    "casilla" INTEGER NOT NULL,
    "casas" INTEGER NOT NULL DEFAULT 0,
    "hotel" BOOLEAN NOT NULL DEFAULT false,
    "hipotecada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Propiedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaccion" (
    "id" TEXT NOT NULL,
    "partidaId" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "tipo" "TipoTransaccion" NOT NULL,
    "monto" INTEGER NOT NULL,
    "concepto" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subasta" (
    "id" TEXT NOT NULL,
    "partidaId" TEXT NOT NULL,
    "casilla" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "ganadorId" TEXT,
    "montoPuja" INTEGER,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subasta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Puja" (
    "id" TEXT NOT NULL,
    "subastaId" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Puja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partida_codigo_key" ON "Partida"("codigo");

-- AddForeignKey
ALTER TABLE "Jugador" ADD CONSTRAINT "Jugador_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Propiedad" ADD CONSTRAINT "Propiedad_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Propiedad" ADD CONSTRAINT "Propiedad_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "Jugador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subasta" ADD CONSTRAINT "Subasta_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Puja" ADD CONSTRAINT "Puja_subastaId_fkey" FOREIGN KEY ("subastaId") REFERENCES "Subasta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Puja" ADD CONSTRAINT "Puja_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
