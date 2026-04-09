import { EconomiaService } from './economia.service';
import { TableroService } from '../tablero/tablero.service';
import { GameState } from '@pagadiario/types';

function makeGameState(jugadores: Record<string, { saldo: number; posicion?: number; enCarcel?: boolean; eliminado?: boolean }>): GameState {
  const entries = Object.entries(jugadores).map(([id, j]) => [id, {
    posicion: j.posicion ?? 0,
    saldo: j.saldo,
    enCarcel: j.enCarcel ?? false,
    turnosEnCarcel: 0,
    cartaSalida: false,
    eliminado: j.eliminado ?? false,
  }]);
  return {
    partidaId: 'partida-test',
    estado: 'EN_CURSO',
    turnoActual: 1,
    jugadorActivoId: Object.keys(jugadores)[0],
    dobles: 0,
    jugadores: Object.fromEntries(entries),
    casas: 32,
    hoteles: 12,
    subastaActiva: null,
  };
}

describe('EconomiaService', () => {
  let service: EconomiaService;
  let tableroService: TableroService;

  beforeEach(() => {
    tableroService = new TableroService();
    service = new EconomiaService();
  });

  // ─── calcularAlquiler ────────────────────────────────────────────────────

  describe('calcularAlquiler – PROPIEDAD', () => {
    const propietarioId = 'j1';
    const gameState = makeGameState({ j1: { saldo: 1500 }, j2: { saldo: 1500 } });

    it('alquiler base sin monopolio (casilla 1 - Mediterráneo, base $2)', () => {
      const props = [{ id: 'p1', casilla: 1, propietarioId, casas: 0, hotel: false, hipotecada: false }];
      const monto = service.calcularAlquiler(1, propietarioId, gameState, 3, 4, props, tableroService);
      expect(monto).toBe(2);
    });

    it('alquiler duplicado con monopolio completo (Mediterráneo + Báltico)', () => {
      const props = [
        { id: 'p1', casilla: 1, propietarioId, casas: 0, hotel: false, hipotecada: false },
        { id: 'p2', casilla: 3, propietarioId, casas: 0, hotel: false, hipotecada: false },
      ];
      const monto = service.calcularAlquiler(1, propietarioId, gameState, 3, 4, props, tableroService);
      expect(monto).toBe(4); // $2 × 2
    });

    it('alquiler con 1 casa (casilla 1 - Mediterráneo, $10)', () => {
      const props = [{ id: 'p1', casilla: 1, propietarioId, casas: 1, hotel: false, hipotecada: false }];
      const monto = service.calcularAlquiler(1, propietarioId, gameState, 3, 4, props, tableroService);
      expect(monto).toBe(10);
    });

    it('alquiler con 2 casas (casilla 1 - Mediterráneo, $30)', () => {
      const props = [{ id: 'p1', casilla: 1, propietarioId, casas: 2, hotel: false, hipotecada: false }];
      const monto = service.calcularAlquiler(1, propietarioId, gameState, 3, 4, props, tableroService);
      expect(monto).toBe(30);
    });

    it('alquiler con 3 casas (casilla 1 - Mediterráneo, $90)', () => {
      const props = [{ id: 'p1', casilla: 1, propietarioId, casas: 3, hotel: false, hipotecada: false }];
      const monto = service.calcularAlquiler(1, propietarioId, gameState, 3, 4, props, tableroService);
      expect(monto).toBe(90);
    });

    it('alquiler con 4 casas (casilla 1 - Mediterráneo, $160)', () => {
      const props = [{ id: 'p1', casilla: 1, propietarioId, casas: 4, hotel: false, hipotecada: false }];
      const monto = service.calcularAlquiler(1, propietarioId, gameState, 3, 4, props, tableroService);
      expect(monto).toBe(160);
    });

    it('alquiler con hotel (casilla 1 - Mediterráneo, $250)', () => {
      const props = [{ id: 'p1', casilla: 1, propietarioId, casas: 0, hotel: true, hipotecada: false }];
      const monto = service.calcularAlquiler(1, propietarioId, gameState, 3, 4, props, tableroService);
      expect(monto).toBe(250);
    });

    it('propiedad hipotecada no cobra alquiler', () => {
      const props = [
        { id: 'p1', casilla: 1, propietarioId, casas: 0, hotel: false, hipotecada: true },
        { id: 'p2', casilla: 3, propietarioId, casas: 0, hotel: false, hipotecada: false },
      ];
      // hipotecada no aparece en propiedadesDelPropietario cuando se llama desde el gateway
      // pero si se incluye hipotecada: true, el grupo NO se considera completo
      const monto = service.calcularAlquiler(3, propietarioId, gameState, 3, 4, props, tableroService);
      // casilla 3 (Báltico) – el grupo no está completo porque casilla 1 está hipotecada
      expect(monto).toBe(4); // base $4, sin duplicar
    });
  });

  describe('calcularAlquiler – FERROCARRIL', () => {
    const propietarioId = 'j1';
    const gameState = makeGameState({ j1: { saldo: 1500 }, j2: { saldo: 1500 } });

    it('1 ferrocarril → $25', () => {
      const props = [{ id: 'p1', casilla: 5, propietarioId, casas: 0, hotel: false, hipotecada: false }];
      const monto = service.calcularAlquiler(5, propietarioId, gameState, 3, 4, props, tableroService);
      expect(monto).toBe(25);
    });

    it('2 ferrocarriles → $50', () => {
      const props = [
        { id: 'p1', casilla: 5, propietarioId, casas: 0, hotel: false, hipotecada: false },
        { id: 'p2', casilla: 15, propietarioId, casas: 0, hotel: false, hipotecada: false },
      ];
      const monto = service.calcularAlquiler(5, propietarioId, gameState, 3, 4, props, tableroService);
      expect(monto).toBe(50);
    });

    it('3 ferrocarriles → $100', () => {
      const props = [
        { id: 'p1', casilla: 5, propietarioId, casas: 0, hotel: false, hipotecada: false },
        { id: 'p2', casilla: 15, propietarioId, casas: 0, hotel: false, hipotecada: false },
        { id: 'p3', casilla: 25, propietarioId, casas: 0, hotel: false, hipotecada: false },
      ];
      const monto = service.calcularAlquiler(5, propietarioId, gameState, 3, 4, props, tableroService);
      expect(monto).toBe(100);
    });

    it('4 ferrocarriles → $200', () => {
      const props = [
        { id: 'p1', casilla: 5, propietarioId, casas: 0, hotel: false, hipotecada: false },
        { id: 'p2', casilla: 15, propietarioId, casas: 0, hotel: false, hipotecada: false },
        { id: 'p3', casilla: 25, propietarioId, casas: 0, hotel: false, hipotecada: false },
        { id: 'p4', casilla: 35, propietarioId, casas: 0, hotel: false, hipotecada: false },
      ];
      const monto = service.calcularAlquiler(5, propietarioId, gameState, 3, 4, props, tableroService);
      expect(monto).toBe(200);
    });

    it('ferrocarril hipotecado no cuenta', () => {
      const props = [
        { id: 'p1', casilla: 5, propietarioId, casas: 0, hotel: false, hipotecada: false },
        { id: 'p2', casilla: 15, propietarioId, casas: 0, hotel: false, hipotecada: true }, // hipotecado
      ];
      const monto = service.calcularAlquiler(5, propietarioId, gameState, 3, 4, props, tableroService);
      expect(monto).toBe(25); // solo 1 activo
    });
  });

  describe('calcularAlquiler – SERVICIO', () => {
    const propietarioId = 'j1';
    const gameState = makeGameState({ j1: { saldo: 1500 }, j2: { saldo: 1500 } });

    it('1 servicio → dados × 4', () => {
      const props = [{ id: 'p1', casilla: 12, propietarioId, casas: 0, hotel: false, hipotecada: false }];
      const monto = service.calcularAlquiler(12, propietarioId, gameState, 3, 4, props, tableroService);
      expect(monto).toBe((3 + 4) * 4); // 28
    });

    it('2 servicios → dados × 10', () => {
      const props = [
        { id: 'p1', casilla: 12, propietarioId, casas: 0, hotel: false, hipotecada: false },
        { id: 'p2', casilla: 28, propietarioId, casas: 0, hotel: false, hipotecada: false },
      ];
      const monto = service.calcularAlquiler(12, propietarioId, gameState, 3, 4, props, tableroService);
      expect(monto).toBe((3 + 4) * 10); // 70
    });
  });

  // ─── calcularAlquilerConDetalle ──────────────────────────────────────────

  describe('calcularAlquilerConDetalle', () => {
    const propietarioId = 'j1';
    const gameState = makeGameState({ j1: { saldo: 1500 }, j2: { saldo: 1500 } });

    it('devuelve tipo PROPIEDAD con campos correctos (sin monopolio)', () => {
      const props = [{ id: 'p1', casilla: 1, propietarioId, casas: 0, hotel: false, hipotecada: false }];
      const detalle = service.calcularAlquilerConDetalle(1, propietarioId, gameState, 3, 4, props, tableroService);
      expect(detalle.tipo).toBe('PROPIEDAD');
      expect(detalle.monto).toBe(2);
      expect(detalle.grupoCompleto).toBe(false);
      expect(detalle.casas).toBe(0);
      expect(detalle.hotel).toBe(false);
      expect(detalle.alquilerBase).toBe(2);
    });

    it('devuelve grupoCompleto=true con monopolio', () => {
      const props = [
        { id: 'p1', casilla: 1, propietarioId, casas: 0, hotel: false, hipotecada: false },
        { id: 'p2', casilla: 3, propietarioId, casas: 0, hotel: false, hipotecada: false },
      ];
      const detalle = service.calcularAlquilerConDetalle(1, propietarioId, gameState, 3, 4, props, tableroService);
      expect(detalle.grupoCompleto).toBe(true);
      expect(detalle.monto).toBe(4);
    });

    it('devuelve tipo FERROCARRIL con totalFerrocarriles', () => {
      const props = [
        { id: 'p1', casilla: 5, propietarioId, casas: 0, hotel: false, hipotecada: false },
        { id: 'p2', casilla: 15, propietarioId, casas: 0, hotel: false, hipotecada: false },
      ];
      const detalle = service.calcularAlquilerConDetalle(5, propietarioId, gameState, 3, 4, props, tableroService);
      expect(detalle.tipo).toBe('FERROCARRIL');
      expect(detalle.totalFerrocarriles).toBe(2);
      expect(detalle.monto).toBe(50);
    });

    it('devuelve tipo SERVICIO con totalDados y multiplicador', () => {
      const props = [{ id: 'p1', casilla: 12, propietarioId, casas: 0, hotel: false, hipotecada: false }];
      const detalle = service.calcularAlquilerConDetalle(12, propietarioId, gameState, 3, 4, props, tableroService);
      expect(detalle.tipo).toBe('SERVICIO');
      expect(detalle.totalDados).toBe(7);
      expect(detalle.multiplicador).toBe(4);
      expect(detalle.monto).toBe(28);
    });
  });

  // ─── pagarAlquiler ───────────────────────────────────────────────────────

  describe('pagarAlquiler', () => {
    it('descuenta al pagador y acredita al propietario', () => {
      const gameState = makeGameState({ j1: { saldo: 1000 }, j2: { saldo: 500 } });
      const resultado = service.pagarAlquiler(gameState, 'j2', 'j1', 100);
      expect(resultado.gameState.jugadores['j2'].saldo).toBe(400);
      expect(resultado.gameState.jugadores['j1'].saldo).toBe(1100);
    });

    it('lanza error si saldo insuficiente', () => {
      const gameState = makeGameState({ j1: { saldo: 1000 }, j2: { saldo: 50 } });
      expect(() => service.pagarAlquiler(gameState, 'j2', 'j1', 100)).toThrow();
    });
  });

  // ─── comprarPropiedad ────────────────────────────────────────────────────

  describe('comprarPropiedad', () => {
    it('descuenta el precio correcto al jugador (casilla 1, $60)', () => {
      const gameState = makeGameState({ j1: { saldo: 1500 } });
      const resultado = service.comprarPropiedad(gameState, 'j1', 1, tableroService);
      expect(resultado.gameState.jugadores['j1'].saldo).toBe(1440);
      expect(resultado.precio).toBe(60);
    });

    it('lanza error si saldo insuficiente', () => {
      const gameState = makeGameState({ j1: { saldo: 30 } });
      expect(() => service.comprarPropiedad(gameState, 'j1', 1, tableroService)).toThrow();
    });

    it('lanza error en casilla no comprable (casilla 0 - Salida)', () => {
      const gameState = makeGameState({ j1: { saldo: 1500 } });
      expect(() => service.comprarPropiedad(gameState, 'j1', 0, tableroService)).toThrow();
    });
  });
});
