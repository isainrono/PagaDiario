import { Injectable, BadRequestException } from '@nestjs/common';
import { GameState } from '@pagadiario/types';
import { TableroService } from '../tablero/tablero.service';

export interface PropiedadConCasilla {
  id: string;
  casilla: number;
  propietarioId: string | null;
  casas: number;
  hotel: boolean;
  hipotecada: boolean;
}

export interface TransaccionData {
  tipo: 'COMPRA' | 'ALQUILER' | 'HIPOTECA' | 'CONSTRUCCION';
  monto: number;
  concepto: string;
}

export interface DetalleAlquiler {
  tipo: 'PROPIEDAD' | 'FERROCARRIL' | 'SERVICIO';
  nombrePropiedad: string;
  monto: number;
  // PROPIEDAD
  casas?: number;
  hotel?: boolean;
  grupoCompleto?: boolean;
  alquilerBase?: number;
  tablaAlquiler?: number[]; // [0casas, 1casa, 2casas, 3casas, 4casas, hotel]
  // FERROCARRIL
  totalFerrocarriles?: number;
  // SERVICIO
  totalServicios?: number;
  totalDados?: number;
  multiplicador?: number;
}

export interface ResultadoCompra {
  gameState: GameState;
  transaccion: TransaccionData;
  precio: number;
}

export interface ResultadoAlquiler {
  gameState: GameState;
  transaccion: TransaccionData;
}

export interface ResultadoHipoteca {
  gameState: GameState;
  valorHipoteca: number;
  transaccion: TransaccionData;
}

export interface ResultadoDeshipoteca {
  gameState: GameState;
  costo: number;
  transaccion: TransaccionData;
}

export interface ResultadoConstruccion {
  gameState: GameState;
  transaccion: TransaccionData;
  construyoHotel: boolean;
}

@Injectable()
export class EconomiaService {
  comprarPropiedad(
    gameState: GameState,
    jugadorId: string,
    casilla: number,
    tableroService: TableroService,
  ): ResultadoCompra {
    const casillaData = tableroService.getCasilla(casilla);

    if (
      casillaData.tipo !== 'PROPIEDAD' &&
      casillaData.tipo !== 'FERROCARRIL' &&
      casillaData.tipo !== 'SERVICIO'
    ) {
      throw new BadRequestException('La casilla no es comprable');
    }

    if (!casillaData.precio) {
      throw new BadRequestException('La casilla no tiene precio definido');
    }

    const estadoJugador = gameState.jugadores[jugadorId];
    if (!estadoJugador) {
      throw new BadRequestException('Jugador no encontrado en el estado de partida');
    }

    if (estadoJugador.saldo < casillaData.precio) {
      throw new BadRequestException(
        `Saldo insuficiente. Tenés $${estadoJugador.saldo}, el precio es $${casillaData.precio}`,
      );
    }

    estadoJugador.saldo -= casillaData.precio;

    return {
      gameState,
      precio: casillaData.precio,
      transaccion: {
        tipo: 'COMPRA',
        monto: casillaData.precio,
        concepto: `Compra de ${casillaData.nombre}`,
      },
    };
  }

  calcularAlquiler(
    casilla: number,
    _propietarioId: string,
    _gameState: GameState,
    dado1: number,
    dado2: number,
    propiedadesDelPropietario: PropiedadConCasilla[],
    tableroService: TableroService,
  ): number {

    const casillaData = tableroService.getCasilla(casilla);

    if (casillaData.tipo === 'FERROCARRIL') {
      const ferrocarriles = propiedadesDelPropietario.filter((p) => {
        const c = tableroService.getCasilla(p.casilla);
        return c.tipo === 'FERROCARRIL' && !p.hipotecada;
      });
      const cantidad = ferrocarriles.length;
      const tarifas: Record<number, number> = { 1: 25, 2: 50, 3: 100, 4: 200 };
      return tarifas[cantidad] ?? 25;
    }

    if (casillaData.tipo === 'SERVICIO') {
      const servicios = propiedadesDelPropietario.filter((p) => {
        const c = tableroService.getCasilla(p.casilla);
        return c.tipo === 'SERVICIO' && !p.hipotecada;
      });
      const cantidad = servicios.length;
      const totalDados = dado1 + dado2;
      return cantidad >= 2 ? totalDados * 10 : totalDados * 4;
    }

    if (casillaData.tipo === 'PROPIEDAD') {
      if (!casillaData.alquiler || casillaData.alquiler.length === 0) return 0;

      const propiedadActual = propiedadesDelPropietario.find(
        (p) => p.casilla === casilla,
      );
      if (!propiedadActual) return 0;

      if (propiedadActual.hotel) {
        return casillaData.alquiler[5] ?? 0;
      }

      const casasEnPropiedad = propiedadActual.casas;
      if (casasEnPropiedad > 0) {
        return casillaData.alquiler[casasEnPropiedad] ?? 0;
      }

      // 0 casas: verificar si tiene el grupo completo para duplicar alquiler base
      if (casillaData.grupo) {
        const casillasMismoGrupo = tableroService
          .getTablero()
          .filter((c) => c.grupo === casillaData.grupo);

        const tieneTodas = casillasMismoGrupo.every((c) =>
          propiedadesDelPropietario.some(
            (p) => p.casilla === c.posicion && !p.hipotecada,
          ),
        );

        if (tieneTodas) {
          return (casillaData.alquiler[0] ?? 0) * 2;
        }
      }

      return casillaData.alquiler[0] ?? 0;
    }

    return 0;
  }

  calcularAlquilerConDetalle(
    casilla: number,
    propietarioId: string,
    gameState: GameState,
    dado1: number,
    dado2: number,
    propiedadesDelPropietario: PropiedadConCasilla[],
    tableroService: TableroService,
  ): DetalleAlquiler {
    const casillaData = tableroService.getCasilla(casilla);

    if (casillaData.tipo === 'FERROCARRIL') {
      const ferrocarriles = propiedadesDelPropietario.filter((p) => {
        const c = tableroService.getCasilla(p.casilla);
        return c.tipo === 'FERROCARRIL' && !p.hipotecada;
      });
      const totalFerrocarriles = ferrocarriles.length;
      const tarifas: Record<number, number> = { 1: 25, 2: 50, 3: 100, 4: 200 };
      const monto = tarifas[totalFerrocarriles] ?? 25;
      return {
        tipo: 'FERROCARRIL',
        nombrePropiedad: casillaData.nombre,
        monto,
        totalFerrocarriles,
      };
    }

    if (casillaData.tipo === 'SERVICIO') {
      const servicios = propiedadesDelPropietario.filter((p) => {
        const c = tableroService.getCasilla(p.casilla);
        return c.tipo === 'SERVICIO' && !p.hipotecada;
      });
      const totalServicios = servicios.length;
      const totalDados = dado1 + dado2;
      const multiplicador = totalServicios >= 2 ? 10 : 4;
      const monto = totalDados * multiplicador;
      return {
        tipo: 'SERVICIO',
        nombrePropiedad: casillaData.nombre,
        monto,
        totalServicios,
        totalDados,
        multiplicador,
      };
    }

    // PROPIEDAD
    if (casillaData.tipo === 'PROPIEDAD') {
      if (!casillaData.alquiler || casillaData.alquiler.length === 0) {
        return { tipo: 'PROPIEDAD', nombrePropiedad: casillaData.nombre, monto: 0 };
      }
      const propiedadActual = propiedadesDelPropietario.find((p) => p.casilla === casilla);
      if (!propiedadActual) {
        return { tipo: 'PROPIEDAD', nombrePropiedad: casillaData.nombre, monto: 0 };
      }

      const tablaAlquiler = casillaData.alquiler.slice(0, 6);

      if (propiedadActual.hotel) {
        return {
          tipo: 'PROPIEDAD',
          nombrePropiedad: casillaData.nombre,
          monto: casillaData.alquiler[5] ?? 0,
          casas: 0,
          hotel: true,
          grupoCompleto: true,
          alquilerBase: casillaData.alquiler[0] ?? 0,
          tablaAlquiler,
        };
      }

      if (propiedadActual.casas > 0) {
        return {
          tipo: 'PROPIEDAD',
          nombrePropiedad: casillaData.nombre,
          monto: casillaData.alquiler[propiedadActual.casas] ?? 0,
          casas: propiedadActual.casas,
          hotel: false,
          grupoCompleto: true,
          alquilerBase: casillaData.alquiler[0] ?? 0,
          tablaAlquiler,
        };
      }

      let grupoCompleto = false;
      if (casillaData.grupo) {
        const casillasMismoGrupo = tableroService
          .getTablero()
          .filter((c) => c.grupo === casillaData.grupo);
        grupoCompleto = casillasMismoGrupo.every((c) =>
          propiedadesDelPropietario.some((p) => p.casilla === c.posicion && !p.hipotecada),
        );
      }

      const monto = grupoCompleto
        ? (casillaData.alquiler[0] ?? 0) * 2
        : (casillaData.alquiler[0] ?? 0);

      return {
        tipo: 'PROPIEDAD',
        nombrePropiedad: casillaData.nombre,
        monto,
        casas: 0,
        hotel: false,
        grupoCompleto,
        alquilerBase: casillaData.alquiler[0] ?? 0,
        tablaAlquiler,
      };
    }

    return { tipo: 'PROPIEDAD', nombrePropiedad: casillaData.nombre, monto: 0 };
  }

  pagarAlquiler(
    gameState: GameState,
    pagadorId: string,
    propietarioId: string,
    monto: number,
  ): ResultadoAlquiler {
    const pagador = gameState.jugadores[pagadorId];
    if (!pagador) {
      throw new BadRequestException('Pagador no encontrado');
    }

    if (pagador.saldo < monto) {
      throw new BadRequestException(
        `Saldo insuficiente para pagar alquiler. Tenés $${pagador.saldo}, debés $${monto}`,
      );
    }

    pagador.saldo -= monto;

    const propietario = gameState.jugadores[propietarioId];
    if (propietario) {
      propietario.saldo += monto;
    }

    return {
      gameState,
      transaccion: {
        tipo: 'ALQUILER',
        monto,
        concepto: `Pago de alquiler`,
      },
    };
  }

  hipotecar(
    gameState: GameState,
    jugadorId: string,
    propiedadId: string,
    propiedades: PropiedadConCasilla[],
    tableroService: TableroService,
  ): ResultadoHipoteca {
    const propiedad = propiedades.find((p) => p.id === propiedadId);
    if (!propiedad) {
      throw new BadRequestException('Propiedad no encontrada');
    }

    if (propiedad.propietarioId !== jugadorId) {
      throw new BadRequestException('No sos el propietario de esta propiedad');
    }

    if (propiedad.hipotecada) {
      throw new BadRequestException('La propiedad ya está hipotecada');
    }

    if (propiedad.hotel || propiedad.casas > 0) {
      throw new BadRequestException(
        'No podés hipotecar una propiedad con casas o hotel',
      );
    }

    const estadoJugador = gameState.jugadores[jugadorId];
    if (!estadoJugador) {
      throw new BadRequestException('Jugador no encontrado en el estado de partida');
    }

    const casillaData = tableroService.getCasilla(propiedad.casilla);
    const valorHipoteca =
      casillaData.hipoteca ?? Math.floor((casillaData.precio ?? 0) / 2);

    estadoJugador.saldo += valorHipoteca;

    return {
      gameState,
      valorHipoteca,
      transaccion: {
        tipo: 'HIPOTECA',
        monto: valorHipoteca,
        concepto: `Hipoteca de ${casillaData.nombre}`,
      },
    };
  }

  deshipotecar(
    gameState: GameState,
    jugadorId: string,
    propiedadId: string,
    propiedades: PropiedadConCasilla[],
    tableroService: TableroService,
  ): ResultadoDeshipoteca {
    const propiedad = propiedades.find((p) => p.id === propiedadId);
    if (!propiedad) {
      throw new BadRequestException('Propiedad no encontrada');
    }

    if (propiedad.propietarioId !== jugadorId) {
      throw new BadRequestException('No sos el propietario de esta propiedad');
    }

    if (!propiedad.hipotecada) {
      throw new BadRequestException('La propiedad no está hipotecada');
    }

    const estadoJugador = gameState.jugadores[jugadorId];
    if (!estadoJugador) {
      throw new BadRequestException('Jugador no encontrado en el estado de partida');
    }

    const casillaData = tableroService.getCasilla(propiedad.casilla);
    const valorHipoteca =
      casillaData.hipoteca ?? Math.floor((casillaData.precio ?? 0) / 2);
    const costo = Math.round(valorHipoteca * 1.1);

    if (estadoJugador.saldo < costo) {
      throw new BadRequestException(
        `Saldo insuficiente. Tenés $${estadoJugador.saldo}, el costo de deshipotecar es $${costo}`,
      );
    }

    estadoJugador.saldo -= costo;

    return {
      gameState,
      costo,
      transaccion: {
        tipo: 'HIPOTECA',
        monto: -costo,
        concepto: `Deshipoteca de ${casillaData.nombre}`,
      },
    };
  }

  construirCasa(
    gameState: GameState,
    jugadorId: string,
    propiedadId: string,
    propiedades: PropiedadConCasilla[],
    tableroService: TableroService,
  ): ResultadoConstruccion {
    const propiedad = propiedades.find((p) => p.id === propiedadId);
    if (!propiedad) {
      throw new BadRequestException('Propiedad no encontrada');
    }

    if (propiedad.propietarioId !== jugadorId) {
      throw new BadRequestException('No sos el propietario de esta propiedad');
    }

    if (propiedad.hotel) {
      throw new BadRequestException('La propiedad ya tiene hotel');
    }

    const casillaData = tableroService.getCasilla(propiedad.casilla);

    if (casillaData.tipo !== 'PROPIEDAD' || !casillaData.grupo) {
      throw new BadRequestException(
        'Solo se pueden construir casas en propiedades de color',
      );
    }

    if (!casillaData.costoEdificio) {
      throw new BadRequestException('Esta propiedad no tiene costo de edificio definido');
    }

    // Verificar grupo completo sin hipotecas
    const casillasMismoGrupo = tableroService
      .getTablero()
      .filter((c) => c.grupo === casillaData.grupo);

    const tieneTodas = casillasMismoGrupo.every((c) =>
      propiedades.some(
        (p) =>
          p.casilla === c.posicion &&
          p.propietarioId === jugadorId &&
          !p.hipotecada,
      ),
    );

    if (!tieneTodas) {
      throw new BadRequestException(
        'Necesitás tener el grupo completo sin hipotecas para construir',
      );
    }

    // Verificar distribución pareja
    const casasActuales = propiedad.casas;
    const casasMinGrupo = Math.min(
      ...casillasMismoGrupo.map((c) => {
        const p = propiedades.find((pr) => pr.casilla === c.posicion);
        return p ? p.casas : 0;
      }),
    );

    if (casasActuales > casasMinGrupo) {
      throw new BadRequestException(
        'Debés construir de manera pareja (diferencia máxima de 1 casa entre propiedades del grupo)',
      );
    }

    const estadoJugador = gameState.jugadores[jugadorId];
    if (!estadoJugador) {
      throw new BadRequestException('Jugador no encontrado en el estado de partida');
    }

    if (estadoJugador.saldo < casillaData.costoEdificio) {
      throw new BadRequestException(
        `Saldo insuficiente. Tenés $${estadoJugador.saldo}, el costo es $${casillaData.costoEdificio}`,
      );
    }

    // Si ya tiene 4 casas → construir hotel
    if (casasActuales === 4) {
      if (gameState.hoteles <= 0) {
        throw new BadRequestException('No hay hoteles disponibles en el banco');
      }

      estadoJugador.saldo -= casillaData.costoEdificio;
      gameState.casas += 4;
      gameState.hoteles -= 1;

      return {
        gameState,
        construyoHotel: true,
        transaccion: {
          tipo: 'CONSTRUCCION',
          monto: casillaData.costoEdificio,
          concepto: `Construcción de hotel en ${casillaData.nombre}`,
        },
      };
    }

    // Construir casa normal
    if (gameState.casas <= 0) {
      throw new BadRequestException('No hay casas disponibles en el banco');
    }

    estadoJugador.saldo -= casillaData.costoEdificio;
    gameState.casas -= 1;

    return {
      gameState,
      construyoHotel: false,
      transaccion: {
        tipo: 'CONSTRUCCION',
        monto: casillaData.costoEdificio,
        concepto: `Construcción de casa en ${casillaData.nombre}`,
      },
    };
  }

  construirHotel(
    gameState: GameState,
    jugadorId: string,
    propiedadId: string,
    propiedades: PropiedadConCasilla[],
    tableroService: TableroService,
  ): ResultadoConstruccion {
    const propiedad = propiedades.find((p) => p.id === propiedadId);
    if (!propiedad) {
      throw new BadRequestException('Propiedad no encontrada');
    }

    if (propiedad.propietarioId !== jugadorId) {
      throw new BadRequestException('No sos el propietario de esta propiedad');
    }

    if (propiedad.casas !== 4) {
      throw new BadRequestException('Necesitás 4 casas para construir un hotel');
    }

    if (propiedad.hotel) {
      throw new BadRequestException('La propiedad ya tiene hotel');
    }

    if (gameState.hoteles <= 0) {
      throw new BadRequestException('No hay hoteles disponibles en el banco');
    }

    const casillaData = tableroService.getCasilla(propiedad.casilla);

    if (!casillaData.costoEdificio) {
      throw new BadRequestException('Esta propiedad no tiene costo de edificio definido');
    }

    const estadoJugador = gameState.jugadores[jugadorId];
    if (!estadoJugador) {
      throw new BadRequestException('Jugador no encontrado en el estado de partida');
    }

    if (estadoJugador.saldo < casillaData.costoEdificio) {
      throw new BadRequestException(
        `Saldo insuficiente. Tenés $${estadoJugador.saldo}, el costo es $${casillaData.costoEdificio}`,
      );
    }

    estadoJugador.saldo -= casillaData.costoEdificio;
    gameState.casas += 4;
    gameState.hoteles -= 1;

    return {
      gameState,
      construyoHotel: true,
      transaccion: {
        tipo: 'CONSTRUCCION',
        monto: casillaData.costoEdificio,
        concepto: `Construcción de hotel en ${casillaData.nombre}`,
      },
    };
  }
}
