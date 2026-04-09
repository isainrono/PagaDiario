import { create } from 'zustand';
import type { Jugador, Propiedad, Transaccion, SubastaActiva, EstadoPartida, ModoMonetario } from '@pagadiario/types';

interface EntradaRanking {
  jugadorId: string;
  patrimonio: number;
}

interface ResultadoSubasta {
  ganadorId: string | null;
  monto: number;
  casilla: number;
}

interface GameStore {
  partidaId: string | null;
  codigo: string | null;
  creadaEn: string | null;
  estado: EstadoPartida;
  modoMonetario: ModoMonetario;
  jugadores: Jugador[];
  miJugadorId: string | null;
  jugadorActivoId: string | null;
  posiciones: Record<string, number>;
  saldos: Record<string, number>;
  transacciones: Transaccion[];
  propiedades: Propiedad[];
  casasDisponibles: number;
  hotelesDisponibles: number;
  subastaActiva: SubastaActiva | null;
  resultadoSubasta: ResultadoSubasta | null;
  turnoConfirmado: boolean;
  ganadorId: string | null;
  ranking: EntradaRanking[] | null;
  setEstado: (estado: Partial<Omit<GameStore, 'setEstado' | 'reset'>>) => void;
  reset: () => void;
}

const initialState = {
  partidaId: null,
  codigo: null,
  creadaEn: null,
  estado: 'ESPERANDO' as EstadoPartida,
  modoMonetario: 'DIGITAL' as ModoMonetario,
  jugadores: [],
  miJugadorId: null,
  jugadorActivoId: null,
  posiciones: {},
  saldos: {},
  transacciones: [],
  propiedades: [],
  casasDisponibles: 32,
  hotelesDisponibles: 12,
  subastaActiva: null,
  resultadoSubasta: null,
  turnoConfirmado: false,
  ganadorId: null,
  ranking: null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,
  setEstado: (estado) => set((prev) => ({ ...prev, ...estado })),
  reset: () => set(initialState),
}));
