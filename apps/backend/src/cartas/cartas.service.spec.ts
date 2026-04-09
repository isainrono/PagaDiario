import { CartasService } from './cartas.service';
import { GameState } from '@pagadiario/types';

function makeGameState(jugadores: Record<string, { saldo: number; posicion: number; enCarcel?: boolean; cartaSalida?: boolean }>): GameState {
  const entries = Object.entries(jugadores).map(([id, j]) => [id, {
    posicion: j.posicion,
    saldo: j.saldo,
    enCarcel: j.enCarcel ?? false,
    turnosEnCarcel: 0,
    cartaSalida: j.cartaSalida ?? false,
    eliminado: false,
  }]);
  return {
    partidaId: 'partida-test',
    estado: 'EN_CURSO',
    turnoActual: 1,
    jugadorActivoId: 'j1',
    dobles: 0,
    jugadores: Object.fromEntries(entries),
    casas: 32,
    hoteles: 12,
    subastaActiva: null,
  };
}

describe('CartasService', () => {
  let service: CartasService;

  beforeEach(() => {
    service = new CartasService();
  });

  // ─── COBRAR ─────────────────────────────────────────────────────────────

  describe('efecto COBRAR', () => {
    it('suma el monto al saldo del jugador', () => {
      const gameState = makeGameState({ j1: { saldo: 1000, posicion: 5 } });
      const carta = { id: 'test', tipo: 'SUERTE' as const, texto: 'Cobrar $50', efecto: { tipo: 'COBRAR' as const, monto: 50 } };
      const resultado = service.aplicarCarta(carta, 'j1', gameState, []);
      expect(resultado.gameState.jugadores['j1'].saldo).toBe(1050);
      expect(resultado.transacciones).toHaveLength(1);
      expect(resultado.transacciones[0].monto).toBe(50);
    });
  });

  // ─── PAGAR ──────────────────────────────────────────────────────────────

  describe('efecto PAGAR', () => {
    it('resta el monto al saldo del jugador', () => {
      const gameState = makeGameState({ j1: { saldo: 1000, posicion: 5 } });
      const carta = { id: 'test', tipo: 'SUERTE' as const, texto: 'Pagar $50', efecto: { tipo: 'PAGAR' as const, monto: 50 } };
      const resultado = service.aplicarCarta(carta, 'j1', gameState, []);
      expect(resultado.gameState.jugadores['j1'].saldo).toBe(950);
      expect(resultado.transacciones[0].monto).toBe(-50);
    });
  });

  // ─── COBRAR_DE_JUGADORES ────────────────────────────────────────────────

  describe('efecto COBRAR_DE_JUGADORES', () => {
    it('cobra de cada jugador activo y acumula en el receptor', () => {
      const gameState = makeGameState({
        j1: { saldo: 1000, posicion: 5 },
        j2: { saldo: 500, posicion: 10 },
        j3: { saldo: 600, posicion: 20 },
      });
      const carta = { id: 'test', tipo: 'SUERTE' as const, texto: 'Doctor', efecto: { tipo: 'COBRAR_DE_JUGADORES' as const, monto: 50 } };
      const resultado = service.aplicarCarta(carta, 'j1', gameState, []);
      expect(resultado.gameState.jugadores['j1'].saldo).toBe(1100); // +100 de 2 jugadores
      expect(resultado.gameState.jugadores['j2'].saldo).toBe(450); // -50
      expect(resultado.gameState.jugadores['j3'].saldo).toBe(550); // -50
    });

    it('no cobra de jugadores eliminados', () => {
      const gameState = makeGameState({
        j1: { saldo: 1000, posicion: 5 },
        j2: { saldo: 500, posicion: 10 },
      });
      gameState.jugadores['j2'].eliminado = true;
      const carta = { id: 'test', tipo: 'SUERTE' as const, texto: 'Doctor', efecto: { tipo: 'COBRAR_DE_JUGADORES' as const, monto: 50 } };
      const resultado = service.aplicarCarta(carta, 'j1', gameState, []);
      expect(resultado.gameState.jugadores['j1'].saldo).toBe(1000); // nadie activo para cobrar
    });
  });

  // ─── PAGAR_A_JUGADORES ──────────────────────────────────────────────────

  describe('efecto PAGAR_A_JUGADORES', () => {
    it('paga a cada jugador activo y descuenta del pagador', () => {
      const gameState = makeGameState({
        j1: { saldo: 1000, posicion: 5 },
        j2: { saldo: 500, posicion: 10 },
        j3: { saldo: 600, posicion: 20 },
      });
      const carta = { id: 'test', tipo: 'SUERTE' as const, texto: 'Cumpleaños', efecto: { tipo: 'PAGAR_A_JUGADORES' as const, monto: 10 } };
      const resultado = service.aplicarCarta(carta, 'j1', gameState, []);
      expect(resultado.gameState.jugadores['j1'].saldo).toBe(980); // -20 (2 jugadores × $10)
      expect(resultado.gameState.jugadores['j2'].saldo).toBe(510); // +10
      expect(resultado.gameState.jugadores['j3'].saldo).toBe(610); // +10
    });
  });

  // ─── PAGAR_POR_EDIFICIOS ────────────────────────────────────────────────

  describe('efecto PAGAR_POR_EDIFICIOS', () => {
    it('cobra $25 por casa y $100 por hotel', () => {
      const gameState = makeGameState({ j1: { saldo: 1000, posicion: 5 } });
      const carta = { id: 'test', tipo: 'SUERTE' as const, texto: 'Reparaciones', efecto: { tipo: 'PAGAR_POR_EDIFICIOS' as const, porCasa: 25, porHotel: 100 } };
      const propiedades = [
        { casas: 2, hotel: false, propietarioId: 'j1' },
        { casas: 0, hotel: true, propietarioId: 'j1' },
        { casas: 1, hotel: false, propietarioId: 'j2' }, // otro jugador, no cuenta
      ];
      const resultado = service.aplicarCarta(carta, 'j1', gameState, propiedades);
      // 2 casas × $25 = $50 + 1 hotel × $100 = $100 → total $150
      expect(resultado.gameState.jugadores['j1'].saldo).toBe(850);
    });

    it('no descuenta nada si no tiene edificios', () => {
      const gameState = makeGameState({ j1: { saldo: 1000, posicion: 5 } });
      const carta = { id: 'test', tipo: 'SUERTE' as const, texto: 'Reparaciones', efecto: { tipo: 'PAGAR_POR_EDIFICIOS' as const, porCasa: 25, porHotel: 100 } };
      const resultado = service.aplicarCarta(carta, 'j1', gameState, []);
      expect(resultado.gameState.jugadores['j1'].saldo).toBe(1000);
      expect(resultado.transacciones).toHaveLength(0);
    });
  });

  // ─── IR_A_CARCEL ─────────────────────────────────────────────────────────

  describe('efecto IR_A_CARCEL', () => {
    it('mueve al jugador a casilla 10 y activa enCarcel', () => {
      const gameState = makeGameState({ j1: { saldo: 1000, posicion: 22 } });
      const carta = { id: 'test', tipo: 'SUERTE' as const, texto: 'Ve a la cárcel', efecto: { tipo: 'IR_A_CARCEL' as const } };
      const resultado = service.aplicarCarta(carta, 'j1', gameState, []);
      expect(resultado.gameState.jugadores['j1'].posicion).toBe(10);
      expect(resultado.gameState.jugadores['j1'].enCarcel).toBe(true);
      expect(resultado.irACarcel).toBe(true);
    });
  });

  // ─── SALIR_CARCEL ────────────────────────────────────────────────────────

  describe('efecto SALIR_CARCEL', () => {
    it('otorga cartaSalida al jugador', () => {
      const gameState = makeGameState({ j1: { saldo: 1000, posicion: 5, enCarcel: true } });
      const carta = { id: 'test', tipo: 'SUERTE' as const, texto: 'Libre de cárcel', efecto: { tipo: 'SALIR_CARCEL' as const } };
      const resultado = service.aplicarCarta(carta, 'j1', gameState, []);
      expect(resultado.gameState.jugadores['j1'].cartaSalida).toBe(true);
    });
  });

  // ─── MOVER_A ─────────────────────────────────────────────────────────────

  describe('efecto MOVER_A', () => {
    it('mueve al jugador a la posición indicada', () => {
      const gameState = makeGameState({ j1: { saldo: 1000, posicion: 10 } });
      const carta = { id: 'test', tipo: 'SUERTE' as const, texto: 'Avanzá a Boardwalk', efecto: { tipo: 'MOVER_A' as const, posicion: 39 } };
      const resultado = service.aplicarCarta(carta, 'j1', gameState, []);
      expect(resultado.gameState.jugadores['j1'].posicion).toBe(39);
      expect(resultado.movimiento?.posicionNueva).toBe(39);
    });

    it('cobra $200 al pasar por Salida (posicion anterior > nueva, no es carcel)', () => {
      const gameState = makeGameState({ j1: { saldo: 1000, posicion: 30 } });
      const carta = { id: 'test', tipo: 'SUERTE' as const, texto: 'Avanzá a Mediterráneo', efecto: { tipo: 'MOVER_A' as const, posicion: 1 } };
      const resultado = service.aplicarCarta(carta, 'j1', gameState, []);
      expect(resultado.gameState.jugadores['j1'].saldo).toBe(1200);
      expect(resultado.movimiento?.pasoPorSalida).toBe(true);
      const salario = resultado.transacciones.find(t => t.tipo === 'SALARIO');
      expect(salario).toBeDefined();
      expect(salario?.monto).toBe(200);
    });

    it('NO cobra $200 al ir a la cárcel (posicion 10)', () => {
      const gameState = makeGameState({ j1: { saldo: 1000, posicion: 30 } });
      const carta = { id: 'test', tipo: 'SUERTE' as const, texto: 'Ve a la cárcel', efecto: { tipo: 'MOVER_A' as const, posicion: 10 } };
      const resultado = service.aplicarCarta(carta, 'j1', gameState, []);
      expect(resultado.gameState.jugadores['j1'].saldo).toBe(1000); // no cobra salario
      expect(resultado.movimiento?.pasoPorSalida).toBe(false);
    });
  });

  // ─── MOVER_RELATIVO ──────────────────────────────────────────────────────

  describe('efecto MOVER_RELATIVO (BUG FIX: pasoPorSalida)', () => {
    it('mueve hacia adelante sin pasar por Salida', () => {
      const gameState = makeGameState({ j1: { saldo: 1000, posicion: 10 } });
      const carta = { id: 'test', tipo: 'SUERTE' as const, texto: 'Avanzá 3', efecto: { tipo: 'MOVER_RELATIVO' as const, casillas: 3 } };
      const resultado = service.aplicarCarta(carta, 'j1', gameState, []);
      expect(resultado.gameState.jugadores['j1'].posicion).toBe(13);
      expect(resultado.movimiento?.pasoPorSalida).toBe(false);
      expect(resultado.gameState.jugadores['j1'].saldo).toBe(1000); // no cobra salario
    });

    it('cobra $200 al pasar por Salida con movimiento relativo', () => {
      const gameState = makeGameState({ j1: { saldo: 1000, posicion: 38 } });
      const carta = { id: 'test', tipo: 'SUERTE' as const, texto: 'Avanzá 3', efecto: { tipo: 'MOVER_RELATIVO' as const, casillas: 3 } };
      const resultado = service.aplicarCarta(carta, 'j1', gameState, []);
      expect(resultado.gameState.jugadores['j1'].posicion).toBe(1); // (38+3)%40 = 1
      expect(resultado.movimiento?.pasoPorSalida).toBe(true);
      expect(resultado.gameState.jugadores['j1'].saldo).toBe(1200);
      const salario = resultado.transacciones.find(t => t.tipo === 'SALARIO');
      expect(salario).toBeDefined();
    });

    it('NO cobra $200 al retroceder aunque nueva posicion < anterior', () => {
      const gameState = makeGameState({ j1: { saldo: 1000, posicion: 10 } });
      const carta = { id: 'test', tipo: 'SUERTE' as const, texto: 'Retrocedé 3', efecto: { tipo: 'MOVER_RELATIVO' as const, casillas: -3 } };
      const resultado = service.aplicarCarta(carta, 'j1', gameState, []);
      expect(resultado.gameState.jugadores['j1'].posicion).toBe(7);
      expect(resultado.movimiento?.pasoPorSalida).toBe(false);
      expect(resultado.gameState.jugadores['j1'].saldo).toBe(1000);
    });
  });
});
