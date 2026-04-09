import { Injectable, BadRequestException } from '@nestjs/common';
import { GameState } from '@pagadiario/types';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

export interface NegociacionState {
  negociacionId: string;
  partidaId: string;
  remitenteId: string;
  destinatarioId: string;
  propiedadesOfrecidas: string[];
  propiedadesRequeridas: string[];
  dineroOfrecido: number;
  dineroRequerido: number;
  estado: 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA';
}

export interface PropiedadTransferida {
  id: string;
  casilla: number;
  nuevoPropietarioId: string;
}

interface ResultadoResponder {
  gameState: GameState;
  negociacion: NegociacionState;
  propiedadesTransferidas: PropiedadTransferida[];
}

@Injectable()
export class NegociacionesService {
  private claveRedis(negociacionId: string): string {
    return `negociacion:${negociacionId}`;
  }

  async crear(
    data: Omit<NegociacionState, 'negociacionId' | 'estado'>,
    redis: RedisService,
  ): Promise<NegociacionState> {
    const negociacion: NegociacionState = {
      ...data,
      negociacionId: randomUUID(),
      estado: 'PENDIENTE',
    };

    await redis.set(
      this.claveRedis(negociacion.negociacionId),
      JSON.stringify(negociacion),
      120,
    );

    return negociacion;
  }

  async responder(
    negociacionId: string,
    aceptar: boolean,
    gameState: GameState,
    prisma: PrismaService,
    redis: RedisService,
  ): Promise<ResultadoResponder> {
    const raw = await redis.get(this.claveRedis(negociacionId));
    if (!raw) {
      throw new BadRequestException(
        'Negociación no encontrada o expirada',
      );
    }

    const negociacion = JSON.parse(raw) as NegociacionState;

    if (negociacion.estado !== 'PENDIENTE') {
      throw new BadRequestException(
        `La negociación ya fue ${negociacion.estado.toLowerCase()}`,
      );
    }

    if (!aceptar) {
      negociacion.estado = 'RECHAZADA';
      await redis.set(
        this.claveRedis(negociacionId),
        JSON.stringify(negociacion),
        120,
      );
      return { gameState, negociacion, propiedadesTransferidas: [] };
    }

    // Validar recursos del remitente
    const estadoRemitente = gameState.jugadores[negociacion.remitenteId];
    if (!estadoRemitente) {
      throw new BadRequestException('Remitente no encontrado en la partida');
    }

    const estadoDestinatario = gameState.jugadores[negociacion.destinatarioId];
    if (!estadoDestinatario) {
      throw new BadRequestException('Destinatario no encontrado en la partida');
    }

    if (estadoRemitente.saldo < negociacion.dineroOfrecido) {
      throw new BadRequestException(
        `El remitente no tiene suficiente dinero para completar el trato`,
      );
    }

    if (estadoDestinatario.saldo < negociacion.dineroRequerido) {
      throw new BadRequestException(
        `El destinatario no tiene suficiente dinero para completar el trato`,
      );
    }

    // Obtener propiedades con sus casillas para validar ownership y registrar en historial
    const todasLasPropIds = [
      ...negociacion.propiedadesOfrecidas,
      ...negociacion.propiedadesRequeridas,
    ];

    const todasLasProps =
      todasLasPropIds.length > 0
        ? await prisma.propiedad.findMany({
            where: { id: { in: todasLasPropIds } },
          })
        : [];

    const propOfrecidasData = todasLasProps.filter((p) =>
      negociacion.propiedadesOfrecidas.includes(p.id),
    );
    const propRequeridasData = todasLasProps.filter((p) =>
      negociacion.propiedadesRequeridas.includes(p.id),
    );

    // Validar ownership
    for (const prop of propOfrecidasData) {
      if (prop.propietarioId !== negociacion.remitenteId) {
        throw new BadRequestException(
          `El remitente ya no es propietario de todas las propiedades ofrecidas`,
        );
      }
    }
    for (const prop of propRequeridasData) {
      if (prop.propietarioId !== negociacion.destinatarioId) {
        throw new BadRequestException(
          `El destinatario ya no es propietario de todas las propiedades requeridas`,
        );
      }
    }

    // Transferir propiedades ofrecidas: remitente -> destinatario
    if (negociacion.propiedadesOfrecidas.length > 0) {
      await prisma.propiedad.updateMany({
        where: { id: { in: negociacion.propiedadesOfrecidas } },
        data: { propietarioId: negociacion.destinatarioId },
      });
    }

    // Transferir propiedades requeridas: destinatario -> remitente
    if (negociacion.propiedadesRequeridas.length > 0) {
      await prisma.propiedad.updateMany({
        where: { id: { in: negociacion.propiedadesRequeridas } },
        data: { propietarioId: negociacion.remitenteId },
      });
    }

    // Transferir dinero
    estadoRemitente.saldo -= negociacion.dineroOfrecido;
    estadoDestinatario.saldo += negociacion.dineroOfrecido;
    estadoDestinatario.saldo -= negociacion.dineroRequerido;
    estadoRemitente.saldo += negociacion.dineroRequerido;

    // Crear transacciones en Prisma
    const transaccionesData = [];

    // Transacciones de dinero
    if (negociacion.dineroOfrecido > 0) {
      transaccionesData.push({
        partidaId: negociacion.partidaId,
        jugadorId: negociacion.remitenteId,
        tipo: 'NEGOCIACION' as const,
        monto: -negociacion.dineroOfrecido,
        concepto: `Pago en negociación`,
      });
      transaccionesData.push({
        partidaId: negociacion.partidaId,
        jugadorId: negociacion.destinatarioId,
        tipo: 'NEGOCIACION' as const,
        monto: negociacion.dineroOfrecido,
        concepto: `Cobro en negociación`,
      });
    }

    if (negociacion.dineroRequerido > 0) {
      transaccionesData.push({
        partidaId: negociacion.partidaId,
        jugadorId: negociacion.destinatarioId,
        tipo: 'NEGOCIACION' as const,
        monto: -negociacion.dineroRequerido,
        concepto: `Pago en negociación`,
      });
      transaccionesData.push({
        partidaId: negociacion.partidaId,
        jugadorId: negociacion.remitenteId,
        tipo: 'NEGOCIACION' as const,
        monto: negociacion.dineroRequerido,
        concepto: `Cobro en negociación`,
      });
    }

    // Transacciones de propiedades (monto 0, para historial)
    for (const prop of propOfrecidasData) {
      transaccionesData.push({
        partidaId: negociacion.partidaId,
        jugadorId: negociacion.remitenteId,
        tipo: 'NEGOCIACION' as const,
        monto: 0,
        concepto: `Venta de Casilla ${prop.casilla} en negociación`,
      });
      transaccionesData.push({
        partidaId: negociacion.partidaId,
        jugadorId: negociacion.destinatarioId,
        tipo: 'NEGOCIACION' as const,
        monto: 0,
        concepto: `Compra de Casilla ${prop.casilla} en negociación`,
      });
    }

    for (const prop of propRequeridasData) {
      transaccionesData.push({
        partidaId: negociacion.partidaId,
        jugadorId: negociacion.destinatarioId,
        tipo: 'NEGOCIACION' as const,
        monto: 0,
        concepto: `Venta de Casilla ${prop.casilla} en negociación`,
      });
      transaccionesData.push({
        partidaId: negociacion.partidaId,
        jugadorId: negociacion.remitenteId,
        tipo: 'NEGOCIACION' as const,
        monto: 0,
        concepto: `Compra de Casilla ${prop.casilla} en negociación`,
      });
    }

    for (const t of transaccionesData) {
      await prisma.transaccion.create({ data: t });
    }

    negociacion.estado = 'ACEPTADA';
    await redis.set(
      this.claveRedis(negociacionId),
      JSON.stringify(negociacion),
      120,
    );

    // Construir lista de propiedades transferidas para emitir eventos en gateway
    const propiedadesTransferidas: PropiedadTransferida[] = [
      ...propOfrecidasData.map((p) => ({
        id: p.id,
        casilla: p.casilla,
        nuevoPropietarioId: negociacion.destinatarioId,
      })),
      ...propRequeridasData.map((p) => ({
        id: p.id,
        casilla: p.casilla,
        nuevoPropietarioId: negociacion.remitenteId,
      })),
    ];

    return { gameState, negociacion, propiedadesTransferidas };
  }
}
