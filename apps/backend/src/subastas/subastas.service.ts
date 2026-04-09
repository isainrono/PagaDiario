import { Injectable, BadRequestException } from '@nestjs/common';
import { GameState, SubastaActiva } from '@pagadiario/types';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

interface ResultadoIniciar {
  gameState: GameState;
  subasta: { subastaId: string; casilla: number; expiraEn: number };
}

interface ResultadoPujar {
  gameState: GameState;
}

interface ResultadoResolver {
  gameState: GameState;
  resultado: { ganadorId: string | null; monto: number; casilla: number };
  transaccion: { jugadorId: string; tipo: 'SUBASTA'; monto: number; concepto: string } | null;
}

@Injectable()
export class SubastasService {
  async iniciar(
    partidaId: string,
    casilla: number,
    gameState: GameState,
    redisService: RedisService,
    prisma: PrismaService,
  ): Promise<ResultadoIniciar> {
    const expiraEnDate = new Date(Date.now() + 60_000);
    const expiraEnTimestamp = expiraEnDate.getTime();

    const subasta = await prisma.subasta.create({
      data: {
        partidaId,
        casilla,
        estado: 'ACTIVA',
        expiraEn: expiraEnDate,
      },
    });

    const subastaActiva: SubastaActiva = {
      subastaId: subasta.id,
      casilla,
      expiraEn: expiraEnTimestamp,
      pujas: [],
    };

    gameState.subastaActiva = subastaActiva;

    await redisService.set(
      `game:${partidaId}`,
      JSON.stringify(gameState),
      86400,
    );

    return {
      gameState,
      subasta: {
        subastaId: subasta.id,
        casilla,
        expiraEn: expiraEnTimestamp,
      },
    };
  }

  pujar(
    subastaId: string,
    jugadorId: string,
    monto: number,
    gameState: GameState,
  ): ResultadoPujar {
    const { subastaActiva } = gameState;

    if (!subastaActiva) {
      throw new BadRequestException('No hay subasta activa en esta partida');
    }

    if (subastaActiva.subastaId !== subastaId) {
      throw new BadRequestException('El ID de subasta no coincide con la subasta activa');
    }

    const estadoJugador = gameState.jugadores[jugadorId];
    if (!estadoJugador) {
      throw new BadRequestException('Jugador no encontrado en la partida');
    }

    if (estadoJugador.eliminado) {
      throw new BadRequestException('Un jugador eliminado no puede pujar');
    }

    const pujaMaxima = subastaActiva.pujas.reduce(
      (max, p) => (p.monto > max ? p.monto : max),
      0,
    );

    if (monto <= pujaMaxima) {
      throw new BadRequestException(
        `El monto debe superar la puja más alta actual ($${pujaMaxima})`,
      );
    }

    if (estadoJugador.saldo < monto) {
      throw new BadRequestException(
        `Saldo insuficiente. Tenés $${estadoJugador.saldo}, querés pujar $${monto}`,
      );
    }

    // Reemplazar puja anterior del mismo jugador (o agregar nueva)
    const pujasFiltradas = subastaActiva.pujas.filter(
      (p) => p.jugadorId !== jugadorId,
    );
    pujasFiltradas.push({ jugadorId, monto });
    subastaActiva.pujas = pujasFiltradas;

    return { gameState };
  }

  async resolver(
    subastaId: string,
    partidaId: string,
    gameState: GameState,
    prisma: PrismaService,
    redisService: RedisService,
  ): Promise<ResultadoResolver> {
    const { subastaActiva } = gameState;

    if (!subastaActiva || subastaActiva.subastaId !== subastaId) {
      // La subasta ya fue resuelta o no existe, no hacer nada
      gameState.subastaActiva = null;
      await redisService.set(
        `game:${partidaId}`,
        JSON.stringify(gameState),
        86400,
      );
      return {
        gameState,
        resultado: { ganadorId: null, monto: 0, casilla: 0 },
        transaccion: null,
      };
    }

    const casilla = subastaActiva.casilla;

    // Encontrar la puja más alta
    let pujaMasAlta: { jugadorId: string; monto: number } | null = null;
    for (const puja of subastaActiva.pujas) {
      if (!pujaMasAlta || puja.monto > pujaMasAlta.monto) {
        pujaMasAlta = puja;
      }
    }

    gameState.subastaActiva = null;

    if (pujaMasAlta) {
      const { jugadorId: ganadorId, monto } = pujaMasAlta;
      const estadoGanador = gameState.jugadores[ganadorId];

      if (estadoGanador) {
        estadoGanador.saldo -= monto;
      }

      // Actualizar o crear Propiedad en Prisma (al inicio del juego ya existen con propietarioId=null)
      const propiedadExistente = await prisma.propiedad.findFirst({
        where: { partidaId, casilla },
      });
      if (propiedadExistente) {
        await prisma.propiedad.update({
          where: { id: propiedadExistente.id },
          data: { propietarioId: ganadorId },
        });
      } else {
        await prisma.propiedad.create({
          data: { partidaId, casilla, propietarioId: ganadorId },
        });
      }

      // Actualizar estado de la subasta en Prisma
      await prisma.subasta.update({
        where: { id: subastaId },
        data: {
          ganadorId,
          montoPuja: monto,
          estado: 'RESUELTA',
        },
      });

      await redisService.set(
        `game:${partidaId}`,
        JSON.stringify(gameState),
        86400,
      );

      return {
        gameState,
        resultado: { ganadorId, monto, casilla },
        transaccion: {
          jugadorId: ganadorId,
          tipo: 'SUBASTA',
          monto,
          concepto: `Ganó subasta de casilla ${casilla}`,
        },
      };
    }

    // Sin pujas: propiedad queda libre
    await prisma.subasta.update({
      where: { id: subastaId },
      data: { estado: 'RESUELTA' },
    });

    await redisService.set(
      `game:${partidaId}`,
      JSON.stringify(gameState),
      86400,
    );

    return {
      gameState,
      resultado: { ganadorId: null, monto: 0, casilla },
      transaccion: null,
    };
  }
}
