import { Injectable } from '@nestjs/common';
import { GameState } from '@pagadiario/types';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TableroService } from '../tablero/tablero.service';
import { PropiedadConCasilla } from '../economia/economia.service';

export interface ResultadoBancarrota {
  gameState: GameState;
  ganador: string | null;
}

export interface EntradaRanking {
  jugadorId: string;
  patrimonio: number;
}

export interface ResultadoFinalizacion {
  ganadorId: string;
  ranking: EntradaRanking[];
}

@Injectable()
export class EndgameService {
  async declararBancarrota(
    gameState: GameState,
    jugadorId: string,
    acreedorId: string | null,
    prisma: PrismaService,
  ): Promise<ResultadoBancarrota> {
    const estadoJugador = gameState.jugadores[jugadorId];
    if (!estadoJugador) {
      return { gameState, ganador: null };
    }

    // Marcar jugador como eliminado
    estadoJugador.eliminado = true;

    if (acreedorId !== null) {
      // Debe a otro jugador: transferir propiedades y saldo al acreedor
      await prisma.propiedad.updateMany({
        where: { propietarioId: jugadorId },
        data: { propietarioId: acreedorId },
      });

      const estadoAcreedor = gameState.jugadores[acreedorId];
      if (estadoAcreedor) {
        estadoAcreedor.saldo += estadoJugador.saldo;
      }
      estadoJugador.saldo = 0;
    } else {
      // Debe al banco: propiedades vuelven a ser libres
      await prisma.propiedad.updateMany({
        where: { propietarioId: jugadorId },
        data: {
          propietarioId: null,
          casas: 0,
          hotel: false,
          hipotecada: false,
        },
      });
      estadoJugador.saldo = 0;
    }

    // Verificar si queda un único jugador activo
    const jugadoresActivos = Object.entries(gameState.jugadores).filter(
      ([, estado]) => !estado.eliminado,
    );

    const ganador =
      jugadoresActivos.length === 1
        ? (jugadoresActivos[0]?.[0] ?? null)
        : null;

    return { gameState, ganador };
  }

  calcularPatrimonio(
    jugadorId: string,
    gameState: GameState,
    propiedades: PropiedadConCasilla[],
    tableroService: TableroService,
  ): number {
    const estadoJugador = gameState.jugadores[jugadorId];
    if (!estadoJugador) return 0;

    let patrimonio = estadoJugador.saldo;

    const propiedadesDelJugador = propiedades.filter(
      (p) => p.propietarioId === jugadorId,
    );

    for (const propiedad of propiedadesDelJugador) {
      const casillaData = tableroService.getCasilla(propiedad.casilla);
      const precio = casillaData.precio ?? 0;
      const hipotecaValor = casillaData.hipoteca ?? Math.floor(precio / 2);
      const costoEdificio = casillaData.costoEdificio ?? 0;

      if (propiedad.hipotecada) {
        patrimonio += hipotecaValor;
      } else {
        patrimonio += precio;
      }

      if (propiedad.hotel) {
        patrimonio += costoEdificio * 5;
      } else if (propiedad.casas > 0) {
        patrimonio += propiedad.casas * costoEdificio;
      }
    }

    return patrimonio;
  }

  async finalizarPartida(
    partidaId: string,
    ganadorId: string,
    gameState: GameState,
    propiedades: PropiedadConCasilla[],
    tableroService: TableroService,
    prisma: PrismaService,
    redis: RedisService,
  ): Promise<ResultadoFinalizacion> {
    // Cambiar estado en Prisma
    await prisma.partida.update({
      where: { id: partidaId },
      data: { estado: 'FINALIZADA' },
    });

    // Cambiar estado en gameState
    gameState.estado = 'FINALIZADA';

    // Calcular patrimonio de todos los jugadores
    const jugadoresIds = Object.keys(gameState.jugadores);

    const ranking: EntradaRanking[] = jugadoresIds
      .map((jId) => ({
        jugadorId: jId,
        patrimonio: this.calcularPatrimonio(
          jId,
          gameState,
          propiedades,
          tableroService,
        ),
        eliminado: gameState.jugadores[jId]?.eliminado ?? false,
      }))
      .sort((a, b) => {
        // No eliminados primero, luego por patrimonio descendente
        if (a.eliminado !== b.eliminado) {
          return a.eliminado ? 1 : -1;
        }
        return b.patrimonio - a.patrimonio;
      })
      .map(({ jugadorId, patrimonio }) => ({ jugadorId, patrimonio }));

    // Eliminar GameState de Redis
    await redis.del(`game:${partidaId}`);

    return { ganadorId, ranking };
  }
}
