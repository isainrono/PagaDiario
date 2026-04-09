import { Injectable } from '@nestjs/common';
import { CasillaData, getCasilla, TABLERO } from './tablero.data';
import { GameState } from '@pagadiario/types';

export type TipoAccionCasilla =
  | 'LIBRE'
  | 'COMPRAR'
  | 'PAGAR_ALQUILER'
  | 'IMPUESTO'
  | 'CARTA_SUERTE'
  | 'CARTA_COMUNIDAD'
  | 'CARCEL'
  | 'PARKING'
  | 'VISITA';

export interface ResultadoMovimiento {
  posicionNueva: number;
  pasoPorSalida: boolean;
}

@Injectable()
export class TableroService {
  calcularMovimiento(
    posicionActual: number,
    dados: number,
  ): ResultadoMovimiento {
    const posicionNueva = (posicionActual + dados) % 40;
    const pasoPorSalida = posicionActual + dados >= 40;
    return { posicionNueva, pasoPorSalida };
  }

  resolverCasilla(
    posicion: number,
    _jugadorId: string,
    _gameState: GameState,
  ): TipoAccionCasilla {
    const casilla: CasillaData = getCasilla(posicion);

    switch (casilla.tipo) {
      case 'SALIDA':
        return 'LIBRE';

      case 'CARCEL_VISITA':
        return 'VISITA';

      case 'VE_A_CARCEL':
        return 'CARCEL';

      case 'PARKING':
        return 'PARKING';

      case 'CARTA_SUERTE':
        return 'CARTA_SUERTE';

      case 'CARTA_COMUNIDAD':
        return 'CARTA_COMUNIDAD';

      case 'IMPUESTO':
        return 'IMPUESTO';

      case 'PROPIEDAD':
      case 'FERROCARRIL':
      case 'SERVICIO':
        // Si la casilla no tiene precio definido, es LIBRE
        if (!casilla.precio) return 'LIBRE';
        // La lógica de propietario se resuelve en el gateway con el estado de Prisma.
        // Aquí señalamos que es comprable/pagable como punto de partida.
        return 'COMPRAR';

      default:
        return 'LIBRE';
    }
  }

  getCasilla(posicion: number): CasillaData {
    return getCasilla(posicion);
  }

  getTablero(): CasillaData[] {
    return TABLERO;
  }
}
