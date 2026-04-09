import { Injectable } from '@nestjs/common';
import { CARTAS_SUERTE, CARTAS_COMUNIDAD, Carta, EfectoCarta } from './cartas.data';
import { GameState } from '@pagadiario/types';

export interface ResultadoCarta {
  carta: Carta;
  gameState: GameState;
  transacciones: { jugadorId: string; tipo: string; monto: number; concepto: string }[];
  movimiento?: { posicionAnterior: number; posicionNueva: number; pasoPorSalida: boolean };
  irACarcel?: boolean;
}

@Injectable()
export class CartasService {
  extraerCarta(tipo: 'SUERTE' | 'COMUNIDAD'): Carta {
    const mazo = tipo === 'SUERTE' ? CARTAS_SUERTE : CARTAS_COMUNIDAD;
    return mazo[Math.floor(Math.random() * mazo.length)];
  }

  aplicarCarta(
    carta: Carta,
    jugadorId: string,
    gameState: GameState,
    propiedades: { casas: number; hotel: boolean; propietarioId: string | null }[],
  ): ResultadoCarta {
    const resultado: ResultadoCarta = {
      carta,
      gameState: { ...gameState },
      transacciones: [],
    };

    const jugadores = { ...resultado.gameState.jugadores };
    const jugador = { ...jugadores[jugadorId] };
    const jugadoresActivos = Object.entries(jugadores)
      .filter(([id, j]) => !j.eliminado && id !== jugadorId);

    const efecto: EfectoCarta = carta.efecto;

    switch (efecto.tipo) {
      case 'MOVER_A': {
        const posicionAnterior = jugador.posicion;
        const posicionNueva = efecto.posicion;
        const pasoPorSalida = posicionNueva < posicionAnterior && posicionNueva !== 10;
        if (pasoPorSalida) {
          jugador.saldo += 200;
          resultado.transacciones.push({ jugadorId, tipo: 'SALARIO', monto: 200, concepto: 'Cobrás $200 al pasar por Salida' });
        }
        jugador.posicion = posicionNueva;
        resultado.movimiento = { posicionAnterior, posicionNueva, pasoPorSalida };
        break;
      }
      case 'MOVER_RELATIVO': {
        const posicionAnterior = jugador.posicion;
        const posicionNueva = ((jugador.posicion + efecto.casillas) + 40) % 40;
        const pasoPorSalida = efecto.casillas > 0 && posicionNueva < posicionAnterior;
        if (pasoPorSalida) {
          jugador.saldo += 200;
          resultado.transacciones.push({ jugadorId, tipo: 'SALARIO', monto: 200, concepto: 'Cobrás $200 al pasar por Salida' });
        }
        jugador.posicion = posicionNueva;
        resultado.movimiento = { posicionAnterior, posicionNueva, pasoPorSalida };
        break;
      }
      case 'IR_A_CARCEL': {
        jugador.posicion = 10;
        jugador.enCarcel = true;
        jugador.turnosEnCarcel = 0;
        resultado.irACarcel = true;
        break;
      }
      case 'SALIR_CARCEL': {
        jugador.cartaSalida = true;
        break;
      }
      case 'COBRAR': {
        jugador.saldo += efecto.monto;
        resultado.transacciones.push({ jugadorId, tipo: 'CARTA', monto: efecto.monto, concepto: carta.texto });
        break;
      }
      case 'PAGAR': {
        jugador.saldo -= efecto.monto;
        resultado.transacciones.push({ jugadorId, tipo: 'CARTA', monto: -efecto.monto, concepto: carta.texto });
        break;
      }
      case 'COBRAR_DE_JUGADORES': {
        let totalCobrado = 0;
        jugadoresActivos.forEach(([otroId, otro]) => {
          const otroCopy = { ...otro };
          otroCopy.saldo -= efecto.monto;
          jugadores[otroId] = otroCopy;
          resultado.transacciones.push({ jugadorId: otroId, tipo: 'CARTA', monto: -efecto.monto, concepto: carta.texto });
          totalCobrado += efecto.monto;
        });
        jugador.saldo += totalCobrado;
        resultado.transacciones.push({ jugadorId, tipo: 'CARTA', monto: totalCobrado, concepto: carta.texto });
        break;
      }
      case 'PAGAR_A_JUGADORES': {
        let totalPagado = 0;
        jugadoresActivos.forEach(([otroId, otro]) => {
          const otroCopy = { ...otro };
          otroCopy.saldo += efecto.monto;
          jugadores[otroId] = otroCopy;
          resultado.transacciones.push({ jugadorId: otroId, tipo: 'CARTA', monto: efecto.monto, concepto: carta.texto });
          totalPagado += efecto.monto;
        });
        jugador.saldo -= totalPagado;
        resultado.transacciones.push({ jugadorId, tipo: 'CARTA', monto: -totalPagado, concepto: carta.texto });
        break;
      }
      case 'PAGAR_POR_EDIFICIOS': {
        const misProps = propiedades.filter(p => p.propietarioId === jugadorId);
        const casas = misProps.reduce((acc, p) => acc + (p.hotel ? 0 : p.casas), 0);
        const hoteles = misProps.filter(p => p.hotel).length;
        const monto = (casas * efecto.porCasa) + (hoteles * efecto.porHotel);
        if (monto > 0) {
          jugador.saldo -= monto;
          resultado.transacciones.push({ jugadorId, tipo: 'CARTA', monto: -monto, concepto: carta.texto });
        }
        break;
      }
    }

    jugadores[jugadorId] = jugador;
    resultado.gameState = { ...resultado.gameState, jugadores };
    return resultado;
  }
}
