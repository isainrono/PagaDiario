export type Ficha =
  | 'PERRO'
  | 'SOMBRERO'
  | 'COCHE'
  | 'BARCO'
  | 'DEDAL'
  | 'CARRETILLA'
  | 'CABALLO'
  | 'PLANCHA';

export type EstadoPartida = 'ESPERANDO' | 'EN_CURSO' | 'FINALIZADA';
export type ModoMonetario = 'DIGITAL' | 'FISICO' | 'HIBRIDO';

export interface Jugador {
  id: string;
  nombre: string;
  ficha: Ficha;
  posicion: number;
  saldo: number;
  enCarcel: boolean;
  turnosEnCarcel: number;
  cartaSalida: boolean;
  eliminado: boolean;
  ordenTurno: number;
}

export interface Propiedad {
  id: string;
  casilla: number;
  propietarioId: string | null;
  casas: number;
  hotel: boolean;
  hipotecada: boolean;
}

export interface Transaccion {
  id: string;
  jugadorId: string;
  tipo: string;
  monto: number;
  concepto: string;
  creadaEn: string;
}

export interface SubastaActiva {
  subastaId: string;
  casilla: number;
  expiraEn: number;
  pujas: { jugadorId: string; monto: number }[];
}

export interface GameState {
  partidaId: string;
  estado: EstadoPartida;
  turnoActual: number;
  jugadorActivoId: string;
  dobles: number;
  jugadores: Record<string, {
    posicion: number;
    saldo: number;
    enCarcel: boolean;
    turnosEnCarcel: number;
    cartaSalida: boolean;
    eliminado: boolean;
  }>;
  casas: number;
  hoteles: number;
  subastaActiva: SubastaActiva | null;
}

export interface EventosCliente {
  'partida:unirse': { codigo: string; jugadorId: string };
  'turno:dados': { partidaId: string; dado1: number; dado2: number };
  'propiedad:comprar': { partidaId: string; casilla: number };
  'propiedad:rechazar': { partidaId: string; casilla: number };
  'subasta:pujar': { subastaId: string; monto: number };
  'turno:terminar': { partidaId: string };
}

export interface EventosServidor {
  'partida:estado': GameState;
  'tablero:movimiento': {
    jugadorId: string;
    posicionAnterior: number;
    posicionNueva: number;
    dado1: number;
    dado2: number;
    dobles: boolean;
  };
  'turno:cambio': { jugadorActivoId: string; turnoNumero: number };
  'economia:transaccion': {
    jugadorId: string;
    tipo: string;
    monto: number;
    concepto: string;
    saldoNuevo: number;
  };
  'error:accion': { codigo: string; mensaje: string };
}
