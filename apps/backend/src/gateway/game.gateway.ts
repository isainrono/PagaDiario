import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PartidasService } from '../partidas/partidas.service';
import { RedisService } from '../redis/redis.service';
import { TableroService } from '../tablero/tablero.service';
import { EconomiaService, PropiedadConCasilla, DetalleAlquiler } from '../economia/economia.service';
import { SubastasService } from '../subastas/subastas.service';
import { NegociacionesService } from '../negociaciones/negociaciones.service';
import { EndgameService } from '../endgame/endgame.service';
import { CartasService } from '../cartas/cartas.service';
import { PrismaService } from '../prisma/prisma.service';
import { JugadorEnSalaDto } from '../partidas/partidas.dto';
import { GameState } from '@pagadiario/types';

interface UnirsePayload {
  codigo: string;
  jugadorId: string;
}

interface IniciarPayload {
  partidaId: string;
  ordenDados: { jugadorId: string; resultado: number }[];
}

interface TurnosDadosPayload {
  partidaId: string;
  dado1: number;
  dado2: number;
}

interface TurnoTerminarPayload {
  partidaId: string;
}

interface ComprarPropiedadPayload {
  partidaId: string;
  casilla: number;
}

interface RechazarPropiedadPayload {
  partidaId: string;
  casilla: number;
}

interface PagarAlquilerPayload {
  partidaId: string;
  propietarioId: string;
  monto: number;
}

interface HipotecarPayload {
  partidaId: string;
  propiedadId: string;
}

interface DeshipotecarPayload {
  partidaId: string;
  propiedadId: string;
}

interface AgregarCasaPayload {
  partidaId: string;
  propiedadId: string;
}

interface AgregarHotelPayload {
  partidaId: string;
  propiedadId: string;
}

interface SubastaPujarPayload {
  subastaId: string;
  monto: number;
}

interface NegociacionProponerPayload {
  partidaId: string;
  destinatarioId: string;
  propiedadesOfrecidas: string[];
  propiedadesRequeridas: string[];
  dineroOfrecido: number;
  dineroRequerido: number;
}

interface NegociacionResponderPayload {
  negociacionId: string;
  aceptar: boolean;
}

interface DeclararBancarrotaPayload {
  partidaId: string;
}

interface CartaEjecutarPayload {
  partidaId: string;
  tipo: 'SUERTE' | 'COMUNIDAD';
}

interface CarcelPagarMultaPayload {
  partidaId: string;
}

interface CarcelUsarCartaPayload {
  partidaId: string;
}

@WebSocketGateway({ cors: true })
export class GameGateway {
  @WebSocketServer()
  server!: Server;

  // Map subastaId -> timeout handle
  private readonly timers = new Map<string, NodeJS.Timeout>();

  // Map jugadorId -> socketId (para enviar mensajes directos)
  private readonly jugadorSockets = new Map<string, string>();

  constructor(
    private readonly partidasService: PartidasService,
    private readonly redisService: RedisService,
    private readonly tableroService: TableroService,
    private readonly economiaService: EconomiaService,
    private readonly subastasService: SubastasService,
    private readonly negociacionesService: NegociacionesService,
    private readonly endgameService: EndgameService,
    private readonly cartasService: CartasService,
    private readonly prisma: PrismaService,
  ) {}

  private async obtenerGameState(partidaId: string): Promise<GameState | null> {
    const raw = await this.redisService.get(`game:${partidaId}`);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  }

  private async guardarGameState(gameState: GameState): Promise<void> {
    await this.redisService.set(
      `game:${gameState.partidaId}`,
      JSON.stringify(gameState),
      86400,
    );
  }

  private obtenerSocketJugadorId(socket: Socket): string | undefined {
    return socket.data.jugadorId as string | undefined;
  }

  private async obtenerPropiedadesPartida(
    partidaId: string,
  ): Promise<PropiedadConCasilla[]> {
    const propiedades = await this.prisma.propiedad.findMany({
      where: { partidaId },
    });
    return propiedades.map((p) => ({
      id: p.id,
      casilla: p.casilla,
      propietarioId: p.propietarioId,
      casas: p.casas,
      hotel: p.hotel,
      hipotecada: p.hipotecada,
    }));
  }

  private async resolverAccionMovimiento(
    posicion: number,
    jugadorId: string,
    partidaId: string,
    gameState: GameState,
    dado1: number,
    dado2: number,
  ): Promise<{ accion: string; propietarioId?: string; monto?: number; detalleAlquiler?: DetalleAlquiler }> {
    const accionBase = this.tableroService.resolverCasilla(posicion, jugadorId, gameState);

    if (accionBase !== 'COMPRAR') {
      return { accion: accionBase };
    }

    const propiedadExistente = await this.prisma.propiedad.findFirst({
      where: { partidaId, casilla: posicion },
    });

    if (!propiedadExistente?.propietarioId) {
      return { accion: 'COMPRAR' };
    }

    const propietarioId = propiedadExistente.propietarioId;

    if (propietarioId === jugadorId) {
      return { accion: 'LIBRE' };
    }

    if (propiedadExistente.hipotecada) {
      return { accion: 'LIBRE' };
    }

    const todasLasPropiedades = await this.obtenerPropiedadesPartida(partidaId);
    const propiedadesDelPropietario = todasLasPropiedades.filter(
      (p) => p.propietarioId === propietarioId,
    );
    const detalleAlquiler = this.economiaService.calcularAlquilerConDetalle(
      posicion,
      propietarioId,
      gameState,
      dado1,
      dado2,
      propiedadesDelPropietario,
      this.tableroService,
    );

    return { accion: 'PAGAR_ALQUILER', propietarioId, monto: detalleAlquiler.monto, detalleAlquiler };
  }

  private calcularCapacidadHipotecaDisponible(
    jugadorId: string,
    propiedades: PropiedadConCasilla[],
  ): number {
    // Sumar valores de hipoteca de propiedades no hipotecadas, sin casas ni hotel
    return propiedades
      .filter(
        (p) =>
          p.propietarioId === jugadorId &&
          !p.hipotecada &&
          !p.hotel &&
          p.casas === 0,
      )
      .reduce((acc, p) => {
        const casillaData = this.tableroService.getCasilla(p.casilla);
        const hipoteca =
          casillaData.hipoteca ??
          Math.floor((casillaData.precio ?? 0) / 2);
        return acc + hipoteca;
      }, 0);
  }

  private async manejarPosibleBancarrota(
    gameState: GameState,
    jugadorId: string,
    acreedorId: string | null,
    deuda: number,
    partidaId: string,
    room: string,
  ): Promise<boolean> {
    // Retorna true si se declaró bancarrota
    const estadoJugador = gameState.jugadores[jugadorId];
    if (!estadoJugador) return false;

    const propiedades = await this.obtenerPropiedadesPartida(partidaId);
    const capacidadHipoteca = this.calcularCapacidadHipotecaDisponible(
      jugadorId,
      propiedades,
    );

    if (estadoJugador.saldo + capacidadHipoteca >= deuda) {
      // Puede hipotecar para cubrir: no es bancarrota todavía
      return false;
    }

    // Bancarrota inevitable
    const resultado = await this.endgameService.declararBancarrota(
      gameState,
      jugadorId,
      acreedorId,
      this.prisma,
    );

    await this.guardarGameState(resultado.gameState);

    this.server.to(room).emit('jugador:bancarrota', {
      jugadorId,
      acreedorId,
    });

    if (resultado.ganador) {
      const propiedadesActuales = await this.obtenerPropiedadesPartida(partidaId);
      const finalizacion = await this.endgameService.finalizarPartida(
        partidaId,
        resultado.ganador,
        resultado.gameState,
        propiedadesActuales,
        this.tableroService,
        this.prisma,
        this.redisService,
      );

      this.server.to(room).emit('partida:finalizada', {
        ganadorId: finalizacion.ganadorId,
        ranking: finalizacion.ranking,
      });
    } else {
      // Avanzar turno sin el jugador eliminado
      this.avanzarTurno(resultado.gameState, jugadorId);
      await this.guardarGameState(resultado.gameState);

      this.server.to(room).emit('turno:cambio', {
        jugadorActivoId: resultado.gameState.jugadorActivoId,
        turnoNumero: resultado.gameState.turnoActual,
      });
    }

    return true;
  }

  private avanzarTurno(
    gameState: GameState,
    jugadorId: string,
  ): { siguienteJugadorId: string } {
    const jugadoresIds = Object.keys(gameState.jugadores);
    const indiceActual = jugadoresIds.indexOf(jugadorId);

    let indiceSiguiente = (indiceActual + 1) % jugadoresIds.length;
    let intentos = 0;

    while (
      gameState.jugadores[jugadoresIds[indiceSiguiente]]?.eliminado &&
      intentos < jugadoresIds.length
    ) {
      indiceSiguiente = (indiceSiguiente + 1) % jugadoresIds.length;
      intentos += 1;
    }

    const siguienteJugadorId = jugadoresIds[indiceSiguiente] ?? jugadorId;
    gameState.jugadorActivoId = siguienteJugadorId;
    gameState.turnoActual += 1;
    gameState.dobles = 0;

    return { siguienteJugadorId };
  }

  private async resolverSubasta(
    subastaId: string,
    partidaId: string,
    room: string,
  ): Promise<void> {
    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) return;

    const resultado = await this.subastasService.resolver(
      subastaId,
      partidaId,
      gameState,
      this.prisma,
      this.redisService,
    );

    if (resultado.transaccion) {
      await this.prisma.transaccion.create({
        data: {
          partidaId,
          jugadorId: resultado.transaccion.jugadorId,
          tipo: resultado.transaccion.tipo,
          monto: resultado.transaccion.monto,
          concepto: resultado.transaccion.concepto,
        },
      });
    }

    // gameState ya guardado en Redis por el servicio
    const { ganadorId, monto, casilla } = resultado.resultado;

    this.server.to(room).emit('subasta:resuelta', {
      subastaId,
      ganadorId,
      monto,
      casilla,
    });

    if (resultado.transaccion && ganadorId) {
      this.server.to(room).emit('economia:transaccion', {
        jugadorId: ganadorId,
        tipo: 'SUBASTA',
        monto: -monto,
        concepto: `Ganó subasta de casilla ${casilla}`,
        saldoNuevo: resultado.gameState.jugadores[ganadorId]?.saldo ?? 0,
      });

      // Si ganó subasta registrar propiedad comprada
      this.server.to(room).emit('propiedad:comprada', {
        casilla,
        propietarioId: ganadorId,
        precio: monto,
        saldoNuevo: resultado.gameState.jugadores[ganadorId]?.saldo ?? 0,
      });
    }

    // Avanzar turno
    const jugadorAnterior = resultado.gameState.jugadorActivoId;
    const { siguienteJugadorId } = this.avanzarTurno(
      resultado.gameState,
      jugadorAnterior,
    );
    await this.guardarGameState(resultado.gameState);

    this.server.to(room).emit('turno:cambio', {
      jugadorActivoId: siguienteJugadorId,
      turnoNumero: resultado.gameState.turnoActual,
    });

    this.timers.delete(subastaId);
  }

  @SubscribeMessage('partida:unirse')
  async handleUnirse(
    @MessageBody() data: UnirsePayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { codigo, jugadorId } = data;

    let partida;
    try {
      partida = await this.partidasService.obtenerPorCodigo(codigo);
    } catch {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Partida no encontrada',
      });
      return;
    }

    const jugadorExiste = partida.jugadores.some(
      (j) => j.jugadorId === jugadorId,
    );

    if (!jugadorExiste) {
      socket.emit('error:accion', {
        codigo: 'JUGADOR_NO_ENCONTRADO',
        mensaje: 'El jugador no pertenece a esta partida',
      });
      return;
    }

    socket.data.jugadorId = jugadorId;
    socket.data.partidaId = partida.partidaId;

    // Registrar socket del jugador para envíos directos
    this.jugadorSockets.set(jugadorId, socket.id);

    const room = `partida_${codigo}`;
    await socket.join(room);

    console.log('[GATEWAY partida:unirse] jugador registrado. jugadorId:', jugadorId, 'socketId:', socket.id, 'room:', room);

    const jugadores: JugadorEnSalaDto[] = partida.jugadores;
    this.server.to(room).emit('sala:actualizada', { jugadores });

    socket.emit('partida:estado', partida);

    // Si la partida está EN_CURSO, enviar estado completo para reconexión
    if (partida.estado === 'EN_CURSO') {
      const gameState = await this.obtenerGameState(partida.partidaId);
      if (gameState) {
        const propiedades = await this.obtenerPropiedadesPartida(partida.partidaId);

        const jugadoresCompletos = partida.jugadores.map((j) => {
          const estadoRedis = gameState.jugadores[j.jugadorId];
          return {
            id: j.jugadorId,
            nombre: j.nombre,
            ficha: j.ficha,
            ordenTurno: j.ordenTurno,
            posicion: estadoRedis?.posicion ?? 0,
            saldo: estadoRedis?.saldo ?? 1500,
            enCarcel: estadoRedis?.enCarcel ?? false,
            turnosEnCarcel: estadoRedis?.turnosEnCarcel ?? 0,
            cartaSalida: estadoRedis?.cartaSalida ?? false,
            eliminado: estadoRedis?.eliminado ?? false,
          };
        });

        const posiciones: Record<string, number> = {};
        const saldos: Record<string, number> = {};
        for (const [id, estado] of Object.entries(gameState.jugadores)) {
          posiciones[id] = estado.posicion;
          saldos[id] = estado.saldo;
        }

        const transacciones = await this.prisma.transaccion.findMany({
          where: { partidaId: partida.partidaId, jugadorId: jugadorId },
          orderBy: { creadaEn: 'desc' },
          take: 100,
        });

        socket.emit('juego:reconexion', {
          jugadores: jugadoresCompletos,
          posiciones,
          saldos,
          jugadorActivoId: gameState.jugadorActivoId,
          propiedades,
          casasDisponibles: gameState.casas,
          hotelesDisponibles: gameState.hoteles,
          transacciones: transacciones.map((t) => ({
            id: t.id,
            jugadorId: t.jugadorId,
            tipo: t.tipo,
            monto: t.monto,
            concepto: t.concepto,
            creadaEn: t.creadaEn.toISOString(),
          })),
        });
      }
    }
  }

  @SubscribeMessage('partida:iniciar')
  async handleIniciar(
    @MessageBody() data: IniciarPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { partidaId, ordenDados } = data;

    try {
      const resultado = await this.partidasService.iniciar(partidaId, {
        ordenDados,
      });

      const partida = await this.partidasService.obtener(partidaId);
      const room = `partida_${partida.codigo}`;

      this.server.to(room).emit('partida:iniciada', {
        ordenTurnos: resultado.ordenTurnos,
      });
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Error al iniciar partida';
      socket.emit('error:accion', {
        codigo: 'ERROR_INICIAR',
        mensaje,
      });
    }
  }

  @SubscribeMessage('turno:dados')
  async handleTurnoDados(
    @MessageBody() data: TurnosDadosPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { partidaId, dado1, dado2 } = data;
    console.log('[GATEWAY turno:dados] recibido:', { partidaId, dado1, dado2, socketId: socket.id });

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      console.log('[GATEWAY turno:dados] ERROR: gameState no encontrado para partidaId:', partidaId);
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }
    console.log('[GATEWAY turno:dados] gameState.jugadorActivoId:', gameState.jugadorActivoId);

    const jugadorId = this.obtenerSocketJugadorId(socket);
    console.log('[GATEWAY turno:dados] jugadorId del socket:', jugadorId);
    if (!jugadorId || jugadorId !== gameState.jugadorActivoId) {
      console.log('[GATEWAY turno:dados] ERROR: no es su turno. jugadorId:', jugadorId, '!== jugadorActivoId:', gameState.jugadorActivoId);
      socket.emit('error:accion', {
        codigo: 'NO_ES_TU_TURNO',
        mensaje: 'No es tu turno',
      });
      return;
    }

    if (
      !Number.isInteger(dado1) || dado1 < 1 || dado1 > 6 ||
      !Number.isInteger(dado2) || dado2 < 1 || dado2 > 6
    ) {
      console.log('[GATEWAY turno:dados] ERROR: dados inválidos:', { dado1, dado2 });
      socket.emit('error:accion', {
        codigo: 'DADOS_INVALIDOS',
        mensaje: 'Los dados deben ser números enteros entre 1 y 6',
      });
      return;
    }

    const estadoJugador = gameState.jugadores[jugadorId];
    if (!estadoJugador) {
      console.log('[GATEWAY turno:dados] ERROR: jugador no encontrado en gameState. jugadorId:', jugadorId, 'jugadores en gameState:', Object.keys(gameState.jugadores));
      socket.emit('error:accion', {
        codigo: 'JUGADOR_NO_ENCONTRADO',
        mensaje: 'Jugador no encontrado en el estado de la partida',
      });
      return;
    }
    console.log('[GATEWAY turno:dados] OK, procesando movimiento. posicion actual:', estadoJugador.posicion);

    const sonDobles = dado1 === dado2;
    const partida = await this.partidasService.obtener(partidaId);
    const room = `partida_${partida.codigo}`;

    // Manejo de cárcel
    if (estadoJugador.enCarcel) {
      if (sonDobles) {
        estadoJugador.enCarcel = false;
        estadoJugador.turnosEnCarcel = 0;
        gameState.dobles = 0;

        const posicionAnterior = estadoJugador.posicion;
        const resultado = this.tableroService.calcularMovimiento(
          estadoJugador.posicion,
          dado1 + dado2,
        );
        estadoJugador.posicion = resultado.posicionNueva;

        if (resultado.pasoPorSalida) {
          estadoJugador.saldo += 200;
          this.server.to(room).emit('economia:transaccion', {
            jugadorId,
            tipo: 'SALARIO',
            monto: 200,
            concepto: 'Pasó por la Salida',
            saldoNuevo: estadoJugador.saldo,
          });
        }

        const { accion, propietarioId: pid1, monto: monto1, detalleAlquiler: detalle1 } =
          await this.resolverAccionMovimiento(
            estadoJugador.posicion,
            jugadorId,
            partidaId,
            gameState,
            dado1,
            dado2,
          );

        await this.guardarGameState(gameState);

        this.server.to(room).emit('carcel:salida', {
          jugadorId,
          motivo: 'DOBLES',
        });

        this.server.to(room).emit('tablero:movimiento', {
          jugadorId,
          posicionAnterior,
          posicionNueva: estadoJugador.posicion,
          dado1,
          dado2,
          dobles: sonDobles,
          accion,
          propietarioId: pid1,
          monto: monto1,
          detalleAlquiler: detalle1,
        });
      } else {
        estadoJugador.turnosEnCarcel += 1;

        if (estadoJugador.turnosEnCarcel >= 3) {
          // Forzar pago y salir
          estadoJugador.saldo -= 50;
          estadoJugador.enCarcel = false;
          estadoJugador.turnosEnCarcel = 0;

          this.server.to(room).emit('economia:transaccion', {
            jugadorId,
            tipo: 'MULTA',
            monto: 50,
            concepto: 'Pago para salir de la cárcel',
            saldoNuevo: estadoJugador.saldo,
          });

          const posicionAnterior = estadoJugador.posicion;
          const resultado = this.tableroService.calcularMovimiento(
            estadoJugador.posicion,
            dado1 + dado2,
          );
          estadoJugador.posicion = resultado.posicionNueva;

          if (resultado.pasoPorSalida) {
            estadoJugador.saldo += 200;
            this.server.to(room).emit('economia:transaccion', {
              jugadorId,
              tipo: 'SALARIO',
              monto: 200,
              concepto: 'Pasó por la Salida',
              saldoNuevo: estadoJugador.saldo,
            });
          }

          const { accion: accion2, propietarioId: pid2, monto: monto2, detalleAlquiler: detalle2 } =
            await this.resolverAccionMovimiento(
              estadoJugador.posicion,
              jugadorId,
              partidaId,
              gameState,
              dado1,
              dado2,
            );

          await this.guardarGameState(gameState);

          this.server.to(room).emit('carcel:salida', {
            jugadorId,
            motivo: 'PAGO',
          });

          this.server.to(room).emit('tablero:movimiento', {
            jugadorId,
            posicionAnterior,
            posicionNueva: estadoJugador.posicion,
            dado1,
            dado2,
            dobles: sonDobles,
            accion: accion2,
            propietarioId: pid2,
            monto: monto2,
            detalleAlquiler: detalle2,
          });
        } else {
          await this.guardarGameState(gameState);

          this.server.to(room).emit('tablero:movimiento', {
            jugadorId,
            posicionAnterior: estadoJugador.posicion,
            posicionNueva: estadoJugador.posicion,
            dado1,
            dado2,
            dobles: sonDobles,
            accion: 'VISITA',
          });
        }
      }
      return;
    }

    // Jugador no está en cárcel
    const posicionAnterior = estadoJugador.posicion;
    const resultado = this.tableroService.calcularMovimiento(
      estadoJugador.posicion,
      dado1 + dado2,
    );
    estadoJugador.posicion = resultado.posicionNueva;

    if (resultado.pasoPorSalida) {
      estadoJugador.saldo += 200;
      this.server.to(room).emit('economia:transaccion', {
        jugadorId,
        tipo: 'SALARIO',
        monto: 200,
        concepto: 'Pasó por la Salida',
        saldoNuevo: estadoJugador.saldo,
      });
    }

    // Casilla 30: Ve a la cárcel
    if (estadoJugador.posicion === 30) {
      estadoJugador.posicion = 10;
      estadoJugador.enCarcel = true;
      gameState.dobles = 0;

      await this.guardarGameState(gameState);

      this.server.to(room).emit('carcel:entrada', {
        jugadorId,
        motivo: 'CASILLA',
      });

      this.server.to(room).emit('tablero:movimiento', {
        jugadorId,
        posicionAnterior,
        posicionNueva: estadoJugador.posicion,
        dado1,
        dado2,
        dobles: sonDobles,
        accion: 'CARCEL',
      });
      return;
    }

    // Manejo de dobles
    if (sonDobles) {
      gameState.dobles += 1;

      if (gameState.dobles >= 3) {
        // Tres dobles seguidos: ir a la cárcel
        estadoJugador.posicion = 10;
        estadoJugador.enCarcel = true;
        gameState.dobles = 0;

        await this.guardarGameState(gameState);

        this.server.to(room).emit('carcel:entrada', {
          jugadorId,
          motivo: 'DOBLES',
        });

        this.server.to(room).emit('tablero:movimiento', {
          jugadorId,
          posicionAnterior,
          posicionNueva: estadoJugador.posicion,
          dado1,
          dado2,
          dobles: sonDobles,
          accion: 'CARCEL',
        });
        return;
      }
    } else {
      gameState.dobles = 0;
    }

    const { accion, propietarioId: pidNormal, monto: montoNormal, detalleAlquiler: detalleNormal } =
      await this.resolverAccionMovimiento(
        estadoJugador.posicion,
        jugadorId,
        partidaId,
        gameState,
        dado1,
        dado2,
      );

    await this.guardarGameState(gameState);

    this.server.to(room).emit('tablero:movimiento', {
      jugadorId,
      posicionAnterior,
      posicionNueva: estadoJugador.posicion,
      dado1,
      dado2,
      dobles: sonDobles,
      accion,
      propietarioId: pidNormal,
      monto: montoNormal,
      detalleAlquiler: detalleNormal,
    });

    // Si son dobles y no fue a la cárcel: el jugador activo mantiene el turno
    // NO emitir turno:cambio
  }

  @SubscribeMessage('turno:terminar')
  async handleTurnoTerminar(
    @MessageBody() data: TurnoTerminarPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { partidaId } = data;

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }

    const jugadorId = this.obtenerSocketJugadorId(socket);
    if (!jugadorId || jugadorId !== gameState.jugadorActivoId) {
      socket.emit('error:accion', {
        codigo: 'NO_ES_TU_TURNO',
        mensaje: 'No es tu turno',
      });
      return;
    }

    const { siguienteJugadorId } = this.avanzarTurno(gameState, jugadorId);

    const partida = await this.partidasService.obtener(partidaId);
    const room = `partida_${partida.codigo}`;

    // Verificar si solo queda un jugador activo (edge case)
    const jugadoresActivos = Object.entries(gameState.jugadores).filter(
      ([, estado]) => !estado.eliminado,
    );

    if (jugadoresActivos.length === 1) {
      const ganadorId = jugadoresActivos[0]?.[0];
      if (ganadorId) {
        const propiedades = await this.obtenerPropiedadesPartida(partidaId);
        const finalizacion = await this.endgameService.finalizarPartida(
          partidaId,
          ganadorId,
          gameState,
          propiedades,
          this.tableroService,
          this.prisma,
          this.redisService,
        );

        this.server.to(room).emit('partida:finalizada', {
          ganadorId: finalizacion.ganadorId,
          ranking: finalizacion.ranking,
        });
        return;
      }
    }

    await this.guardarGameState(gameState);

    this.server.to(room).emit('turno:cambio', {
      jugadorActivoId: siguienteJugadorId,
      turnoNumero: gameState.turnoActual,
    });
  }

  @SubscribeMessage('propiedad:comprar')
  async handleComprarPropiedad(
    @MessageBody() data: ComprarPropiedadPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { partidaId, casilla } = data;

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }

    const jugadorId = this.obtenerSocketJugadorId(socket);
    if (!jugadorId || jugadorId !== gameState.jugadorActivoId) {
      socket.emit('error:accion', {
        codigo: 'NO_ES_TU_TURNO',
        mensaje: 'No es tu turno',
      });
      return;
    }

    // Verificar que la casilla no tiene propietario
    const propiedadExistente = await this.prisma.propiedad.findFirst({
      where: { partidaId, casilla },
    });

    if (propiedadExistente?.propietarioId !== null && propiedadExistente?.propietarioId !== undefined) {
      socket.emit('error:accion', {
        codigo: 'PROPIEDAD_CON_DUENO',
        mensaje: 'Esta propiedad ya tiene propietario',
      });
      return;
    }

    try {
      const resultado = this.economiaService.comprarPropiedad(
        gameState,
        jugadorId,
        casilla,
        this.tableroService,
      );

      // Persistir en Prisma: actualizar o crear Propiedad
      if (propiedadExistente) {
        await this.prisma.propiedad.update({
          where: { id: propiedadExistente.id },
          data: { propietarioId: jugadorId },
        });
      } else {
        await this.prisma.propiedad.create({
          data: {
            partidaId,
            casilla,
            propietarioId: jugadorId,
          },
        });
      }

      await this.prisma.transaccion.create({
        data: {
          partidaId,
          jugadorId,
          tipo: 'COMPRA',
          monto: resultado.transaccion.monto,
          concepto: resultado.transaccion.concepto,
        },
      });

      await this.guardarGameState(resultado.gameState);

      const partida = await this.partidasService.obtener(partidaId);
      const room = `partida_${partida.codigo}`;

      this.server.to(room).emit('propiedad:comprada', {
        casilla,
        propietarioId: jugadorId,
        precio: resultado.precio,
        saldoNuevo: resultado.gameState.jugadores[jugadorId]?.saldo ?? 0,
      });

      this.server.to(room).emit('economia:transaccion', {
        jugadorId,
        tipo: 'COMPRA',
        monto: -resultado.transaccion.monto,
        concepto: resultado.transaccion.concepto,
        saldoNuevo: resultado.gameState.jugadores[jugadorId]?.saldo ?? 0,
      });
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Error al comprar propiedad';
      socket.emit('error:accion', {
        codigo: 'ERROR_COMPRA',
        mensaje,
      });
    }
  }

  @SubscribeMessage('propiedad:rechazar')
  async handleRechazarPropiedad(
    @MessageBody() data: RechazarPropiedadPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { partidaId, casilla } = data;

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }

    const jugadorId = this.obtenerSocketJugadorId(socket);
    if (!jugadorId || jugadorId !== gameState.jugadorActivoId) {
      socket.emit('error:accion', {
        codigo: 'NO_ES_TU_TURNO',
        mensaje: 'No es tu turno',
      });
      return;
    }

    try {
      const partida = await this.partidasService.obtener(partidaId);
      const room = `partida_${partida.codigo}`;

      const resultado = await this.subastasService.iniciar(
        partidaId,
        casilla,
        gameState,
        this.redisService,
        this.prisma,
      );

      const { subastaId, expiraEn } = resultado.subasta;

      this.server.to(room).emit('subasta:iniciada', {
        subastaId,
        casilla,
        expiraEn,
      });

      // Programar resolución automática en 60 segundos
      const timer = setTimeout(() => {
        void this.resolverSubasta(subastaId, partidaId, room);
      }, 60_000);

      this.timers.set(subastaId, timer);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Error al iniciar subasta';
      socket.emit('error:accion', {
        codigo: 'ERROR_SUBASTA',
        mensaje,
      });
    }
  }

  @SubscribeMessage('subasta:pujar')
  async handleSubastaPujar(
    @MessageBody() data: SubastaPujarPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { subastaId, monto } = data;

    const jugadorId = this.obtenerSocketJugadorId(socket);
    if (!jugadorId) {
      socket.emit('error:accion', {
        codigo: 'NO_AUTENTICADO',
        mensaje: 'No autenticado',
      });
      return;
    }

    const partidaId = socket.data.partidaId as string | undefined;
    if (!partidaId) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'No estás unido a ninguna partida',
      });
      return;
    }

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }

    if (!gameState.subastaActiva || gameState.subastaActiva.subastaId !== subastaId) {
      socket.emit('error:accion', {
        codigo: 'SUBASTA_NO_ACTIVA',
        mensaje: 'No hay subasta activa con ese ID',
      });
      return;
    }

    try {
      const resultado = this.subastasService.pujar(
        subastaId,
        jugadorId,
        monto,
        gameState,
      );

      await this.guardarGameState(resultado.gameState);

      const partida = await this.partidasService.obtener(partidaId);
      const room = `partida_${partida.codigo}`;

      this.server.to(room).emit('subasta:nuevaPuja', {
        subastaId,
        jugadorId,
        monto,
      });
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Error al pujar';
      socket.emit('error:accion', {
        codigo: 'ERROR_PUJA',
        mensaje,
      });
    }
  }

  @SubscribeMessage('negociacion:proponer')
  async handleNegociacionProponer(
    @MessageBody() data: NegociacionProponerPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const {
      partidaId,
      destinatarioId,
      propiedadesOfrecidas,
      propiedadesRequeridas,
      dineroOfrecido,
      dineroRequerido,
    } = data;

    const remitenteId = this.obtenerSocketJugadorId(socket);
    if (!remitenteId) {
      socket.emit('error:accion', {
        codigo: 'NO_AUTENTICADO',
        mensaje: 'No autenticado',
      });
      return;
    }

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }

    const estadoRemitente = gameState.jugadores[remitenteId];
    if (!estadoRemitente || estadoRemitente.eliminado) {
      socket.emit('error:accion', {
        codigo: 'JUGADOR_NO_ACTIVO',
        mensaje: 'No sos un jugador activo en esta partida',
      });
      return;
    }

    // Validar que el remitente es propietario de las propiedades ofrecidas
    if (propiedadesOfrecidas.length > 0) {
      const props = await this.prisma.propiedad.findMany({
        where: { id: { in: propiedadesOfrecidas } },
      });
      for (const prop of props) {
        if (prop.propietarioId !== remitenteId) {
          socket.emit('error:accion', {
            codigo: 'NO_ES_PROPIETARIO',
            mensaje: 'No sos propietario de todas las propiedades ofrecidas',
          });
          return;
        }
      }
    }

    try {
      const negociacion = await this.negociacionesService.crear(
        {
          partidaId,
          remitenteId,
          destinatarioId,
          propiedadesOfrecidas,
          propiedadesRequeridas,
          dineroOfrecido,
          dineroRequerido,
        },
        this.redisService,
      );

      // Emitir SOLO al destinatario
      const destinatarioSocketId = this.jugadorSockets.get(destinatarioId);
      if (!destinatarioSocketId) {
        socket.emit('error:accion', {
          codigo: 'DESTINATARIO_NO_CONECTADO',
          mensaje: 'El jugador destinatario no está conectado en este momento',
        });
        return;
      }

      this.server.to(destinatarioSocketId).emit('negociacion:propuesta', {
        negociacionId: negociacion.negociacionId,
        remitenteId,
        detalles: {
          propiedadesOfrecidas,
          propiedadesRequeridas,
          dineroOfrecido,
          dineroRequerido,
        },
      });

      // Confirmar al remitente que la propuesta fue enviada
      socket.emit('negociacion:enviada', { negociacionId: negociacion.negociacionId });
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Error al proponer negociación';
      socket.emit('error:accion', {
        codigo: 'ERROR_NEGOCIACION',
        mensaje,
      });
    }
  }

  @SubscribeMessage('negociacion:responder')
  async handleNegociacionResponder(
    @MessageBody() data: NegociacionResponderPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { negociacionId, aceptar } = data;

    const jugadorId = this.obtenerSocketJugadorId(socket);
    if (!jugadorId) {
      socket.emit('error:accion', {
        codigo: 'NO_AUTENTICADO',
        mensaje: 'No autenticado',
      });
      return;
    }

    const partidaId = socket.data.partidaId as string | undefined;
    if (!partidaId) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'No estás unido a ninguna partida',
      });
      return;
    }

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }

    try {
      const resultado = await this.negociacionesService.responder(
        negociacionId,
        aceptar,
        gameState,
        this.prisma,
        this.redisService,
      );

      await this.guardarGameState(resultado.gameState);

      const partida = await this.partidasService.obtener(partidaId);
      const room = `partida_${partida.codigo}`;

      this.server.to(room).emit('negociacion:resuelta', {
        negociacionId,
        aceptada: aceptar,
      });

      if (aceptar) {
        const neg = resultado.negociacion;

        // Emitir transacciones de dinero si aplica
        if (neg.dineroOfrecido > 0) {
          this.server.to(room).emit('economia:transaccion', {
            jugadorId: neg.remitenteId,
            tipo: 'NEGOCIACION',
            monto: -neg.dineroOfrecido,
            concepto: 'Pago en negociación',
            saldoNuevo: resultado.gameState.jugadores[neg.remitenteId]?.saldo ?? 0,
          });
          this.server.to(room).emit('economia:transaccion', {
            jugadorId: neg.destinatarioId,
            tipo: 'NEGOCIACION',
            monto: neg.dineroOfrecido,
            concepto: 'Cobro en negociación',
            saldoNuevo: resultado.gameState.jugadores[neg.destinatarioId]?.saldo ?? 0,
          });
        }

        if (neg.dineroRequerido > 0) {
          this.server.to(room).emit('economia:transaccion', {
            jugadorId: neg.destinatarioId,
            tipo: 'NEGOCIACION',
            monto: -neg.dineroRequerido,
            concepto: 'Pago en negociación',
            saldoNuevo: resultado.gameState.jugadores[neg.destinatarioId]?.saldo ?? 0,
          });
          this.server.to(room).emit('economia:transaccion', {
            jugadorId: neg.remitenteId,
            tipo: 'NEGOCIACION',
            monto: neg.dineroRequerido,
            concepto: 'Cobro en negociación',
            saldoNuevo: resultado.gameState.jugadores[neg.remitenteId]?.saldo ?? 0,
          });
        }

        // Emitir cambios de propietario para cada propiedad transferida
        for (const prop of resultado.propiedadesTransferidas) {
          this.server.to(room).emit('propiedad:transferida', {
            propiedadId: prop.id,
            casilla: prop.casilla,
            nuevoPropietarioId: prop.nuevoPropietarioId,
          });
        }
      }
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Error al responder negociación';
      socket.emit('error:accion', {
        codigo: 'ERROR_NEGOCIACION',
        mensaje,
      });
    }
  }

  @SubscribeMessage('economia:pagarAlquiler')
  async handlePagarAlquiler(
    @MessageBody() data: PagarAlquilerPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { partidaId, propietarioId, monto } = data;

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }

    const jugadorId = this.obtenerSocketJugadorId(socket);
    if (!jugadorId || jugadorId !== gameState.jugadorActivoId) {
      socket.emit('error:accion', {
        codigo: 'NO_ES_TU_TURNO',
        mensaje: 'No es tu turno',
      });
      return;
    }

    const partida = await this.partidasService.obtener(partidaId);
    const room = `partida_${partida.codigo}`;

    // Verificar si el jugador tiene saldo suficiente
    const estadoJugador = gameState.jugadores[jugadorId];
    if (!estadoJugador) return;

    if (estadoJugador.saldo < monto) {
      // Saldo insuficiente: verificar si puede hipotecar para cubrir
      const acreedorId = propietarioId !== '' ? propietarioId : null;
      const declaroBancarrota = await this.manejarPosibleBancarrota(
        gameState,
        jugadorId,
        acreedorId,
        monto,
        partidaId,
        room,
      );

      if (!declaroBancarrota) {
        socket.emit('error:accion', {
          codigo: 'SALDO_INSUFICIENTE',
          mensaje: 'Hipotecá propiedades para pagar el alquiler',
        });
      }
      return;
    }

    try {
      const resultado = this.economiaService.pagarAlquiler(
        gameState,
        jugadorId,
        propietarioId,
        monto,
      );

      // Persistir transaccion del pagador
      await this.prisma.transaccion.create({
        data: {
          partidaId,
          jugadorId,
          tipo: 'ALQUILER',
          monto: -monto,
          concepto: `Pago de alquiler`,
        },
      });

      await this.guardarGameState(resultado.gameState);

      // Evento para el pagador (monto negativo)
      this.server.to(room).emit('economia:transaccion', {
        jugadorId,
        tipo: 'ALQUILER',
        monto: -monto,
        concepto: `Pagó alquiler`,
        saldoNuevo: resultado.gameState.jugadores[jugadorId]?.saldo ?? 0,
      });

      // Evento para el cobrador (monto positivo)
      const propietarioEnJuego = resultado.gameState.jugadores[propietarioId];
      if (propietarioEnJuego) {
        this.server.to(room).emit('economia:transaccion', {
          jugadorId: propietarioId,
          tipo: 'ALQUILER',
          monto,
          concepto: `Cobró alquiler`,
          saldoNuevo: propietarioEnJuego.saldo,
        });
      }
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Error al pagar alquiler';
      socket.emit('error:accion', {
        codigo: 'ERROR_ALQUILER',
        mensaje,
      });
    }
  }

  @SubscribeMessage('propiedad:hipotecar')
  async handleHipotecar(
    @MessageBody() data: HipotecarPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { partidaId, propiedadId } = data;

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }

    const jugadorId = this.obtenerSocketJugadorId(socket);
    if (!jugadorId) {
      socket.emit('error:accion', {
        codigo: 'NO_AUTENTICADO',
        mensaje: 'No autenticado',
      });
      return;
    }

    try {
      const propiedades = await this.obtenerPropiedadesPartida(partidaId);

      const resultado = this.economiaService.hipotecar(
        gameState,
        jugadorId,
        propiedadId,
        propiedades,
        this.tableroService,
      );

      // Actualizar Prisma: hipotecada = true
      await this.prisma.propiedad.update({
        where: { id: propiedadId },
        data: { hipotecada: true },
      });

      await this.prisma.transaccion.create({
        data: {
          partidaId,
          jugadorId,
          tipo: 'HIPOTECA',
          monto: resultado.transaccion.monto,
          concepto: resultado.transaccion.concepto,
        },
      });

      await this.guardarGameState(resultado.gameState);

      const partida = await this.partidasService.obtener(partidaId);
      const room = `partida_${partida.codigo}`;

      this.server.to(room).emit('economia:transaccion', {
        jugadorId,
        tipo: 'HIPOTECA',
        monto: resultado.valorHipoteca,
        concepto: resultado.transaccion.concepto,
        saldoNuevo: resultado.gameState.jugadores[jugadorId]?.saldo ?? 0,
      });

      this.server.to(room).emit('propiedad:hipotecada', {
        propiedadId,
        hipotecada: true,
      });
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Error al hipotecar';
      socket.emit('error:accion', {
        codigo: 'ERROR_HIPOTECA',
        mensaje,
      });
    }
  }

  @SubscribeMessage('propiedad:deshipotecar')
  async handleDeshipotecar(
    @MessageBody() data: DeshipotecarPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { partidaId, propiedadId } = data;

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }

    const jugadorId = this.obtenerSocketJugadorId(socket);
    if (!jugadorId) {
      socket.emit('error:accion', {
        codigo: 'NO_AUTENTICADO',
        mensaje: 'No autenticado',
      });
      return;
    }

    try {
      const propiedades = await this.obtenerPropiedadesPartida(partidaId);

      const resultado = this.economiaService.deshipotecar(
        gameState,
        jugadorId,
        propiedadId,
        propiedades,
        this.tableroService,
      );

      // Actualizar Prisma: hipotecada = false
      await this.prisma.propiedad.update({
        where: { id: propiedadId },
        data: { hipotecada: false },
      });

      await this.prisma.transaccion.create({
        data: {
          partidaId,
          jugadorId,
          tipo: 'HIPOTECA',
          monto: resultado.transaccion.monto,
          concepto: resultado.transaccion.concepto,
        },
      });

      await this.guardarGameState(resultado.gameState);

      const partida = await this.partidasService.obtener(partidaId);
      const room = `partida_${partida.codigo}`;

      this.server.to(room).emit('economia:transaccion', {
        jugadorId,
        tipo: 'HIPOTECA',
        monto: -resultado.costo,
        concepto: resultado.transaccion.concepto,
        saldoNuevo: resultado.gameState.jugadores[jugadorId]?.saldo ?? 0,
      });

      this.server.to(room).emit('propiedad:hipotecada', {
        propiedadId,
        hipotecada: false,
      });
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Error al deshipotecar';
      socket.emit('error:accion', {
        codigo: 'ERROR_DESHIPOTECA',
        mensaje,
      });
    }
  }

  @SubscribeMessage('construccion:agregarCasa')
  async handleAgregarCasa(
    @MessageBody() data: AgregarCasaPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { partidaId, propiedadId } = data;

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }

    const jugadorId = this.obtenerSocketJugadorId(socket);
    if (!jugadorId) {
      socket.emit('error:accion', {
        codigo: 'NO_AUTENTICADO',
        mensaje: 'No autenticado',
      });
      return;
    }

    try {
      const propiedades = await this.obtenerPropiedadesPartida(partidaId);

      const resultado = this.economiaService.construirCasa(
        gameState,
        jugadorId,
        propiedadId,
        propiedades,
        this.tableroService,
      );

      // Actualizar Prisma: propiedad.casas += 1 o hotel si corresponde
      if (resultado.construyoHotel) {
        await this.prisma.propiedad.update({
          where: { id: propiedadId },
          data: { hotel: true, casas: 0 },
        });
      } else {
        const propiedadActual = propiedades.find((p) => p.id === propiedadId);
        await this.prisma.propiedad.update({
          where: { id: propiedadId },
          data: { casas: (propiedadActual?.casas ?? 0) + 1 },
        });
      }

      await this.prisma.transaccion.create({
        data: {
          partidaId,
          jugadorId,
          tipo: 'CONSTRUCCION',
          monto: resultado.transaccion.monto,
          concepto: resultado.transaccion.concepto,
        },
      });

      await this.guardarGameState(resultado.gameState);

      const partida = await this.partidasService.obtener(partidaId);
      const room = `partida_${partida.codigo}`;

      // Determinar estado actualizado de la propiedad
      const propiedadActualizada = resultado.construyoHotel
        ? { casas: 0, hotel: true }
        : { casas: (propiedades.find((p) => p.id === propiedadId)?.casas ?? 0) + 1, hotel: false };

      this.server.to(room).emit('construccion:actualizada', {
        propiedadId,
        casas: propiedadActualizada.casas,
        hotel: propiedadActualizada.hotel,
        casasDisponibles: resultado.gameState.casas,
        hotelesDisponibles: resultado.gameState.hoteles,
      });

      this.server.to(room).emit('economia:transaccion', {
        jugadorId,
        tipo: 'CONSTRUCCION',
        monto: -resultado.transaccion.monto,
        concepto: resultado.transaccion.concepto,
        saldoNuevo: resultado.gameState.jugadores[jugadorId]?.saldo ?? 0,
      });
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Error al construir casa';
      socket.emit('error:accion', {
        codigo: 'ERROR_CONSTRUCCION',
        mensaje,
      });
    }
  }

  @SubscribeMessage('construccion:agregarHotel')
  async handleAgregarHotel(
    @MessageBody() data: AgregarHotelPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { partidaId, propiedadId } = data;

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }

    const jugadorId = this.obtenerSocketJugadorId(socket);
    if (!jugadorId) {
      socket.emit('error:accion', {
        codigo: 'NO_AUTENTICADO',
        mensaje: 'No autenticado',
      });
      return;
    }

    try {
      const propiedades = await this.obtenerPropiedadesPartida(partidaId);

      const resultado = this.economiaService.construirHotel(
        gameState,
        jugadorId,
        propiedadId,
        propiedades,
        this.tableroService,
      );

      // Actualizar Prisma: hotel = true, casas = 0
      await this.prisma.propiedad.update({
        where: { id: propiedadId },
        data: { hotel: true, casas: 0 },
      });

      await this.prisma.transaccion.create({
        data: {
          partidaId,
          jugadorId,
          tipo: 'CONSTRUCCION',
          monto: resultado.transaccion.monto,
          concepto: resultado.transaccion.concepto,
        },
      });

      await this.guardarGameState(resultado.gameState);

      const partida = await this.partidasService.obtener(partidaId);
      const room = `partida_${partida.codigo}`;

      this.server.to(room).emit('construccion:actualizada', {
        propiedadId,
        casas: 0,
        hotel: true,
        casasDisponibles: resultado.gameState.casas,
        hotelesDisponibles: resultado.gameState.hoteles,
      });

      this.server.to(room).emit('economia:transaccion', {
        jugadorId,
        tipo: 'CONSTRUCCION',
        monto: -resultado.transaccion.monto,
        concepto: resultado.transaccion.concepto,
        saldoNuevo: resultado.gameState.jugadores[jugadorId]?.saldo ?? 0,
      });
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Error al construir hotel';
      socket.emit('error:accion', {
        codigo: 'ERROR_CONSTRUCCION',
        mensaje,
      });
    }
  }

  @SubscribeMessage('jugador:declarar_bancarrota')
  async handleDeclararBancarrota(
    @MessageBody() data: DeclararBancarrotaPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { partidaId } = data;

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }

    const jugadorId = this.obtenerSocketJugadorId(socket);
    if (!jugadorId || jugadorId !== gameState.jugadorActivoId) {
      socket.emit('error:accion', {
        codigo: 'NO_ES_TU_TURNO',
        mensaje: 'Solo el jugador activo puede declarar bancarrota',
      });
      return;
    }

    const partida = await this.partidasService.obtener(partidaId);
    const room = `partida_${partida.codigo}`;

    // Bancarrota voluntaria: siempre al banco (acreedorId = null)
    const resultado = await this.endgameService.declararBancarrota(
      gameState,
      jugadorId,
      null,
      this.prisma,
    );

    await this.guardarGameState(resultado.gameState);

    this.server.to(room).emit('jugador:bancarrota', {
      jugadorId,
      acreedorId: null,
    });

    if (resultado.ganador) {
      const propiedades = await this.obtenerPropiedadesPartida(partidaId);
      const finalizacion = await this.endgameService.finalizarPartida(
        partidaId,
        resultado.ganador,
        resultado.gameState,
        propiedades,
        this.tableroService,
        this.prisma,
        this.redisService,
      );

      this.server.to(room).emit('partida:finalizada', {
        ganadorId: finalizacion.ganadorId,
        ranking: finalizacion.ranking,
      });
    } else {
      // Avanzar turno sin el jugador eliminado
      this.avanzarTurno(resultado.gameState, jugadorId);
      await this.guardarGameState(resultado.gameState);

      this.server.to(room).emit('turno:cambio', {
        jugadorActivoId: resultado.gameState.jugadorActivoId,
        turnoNumero: resultado.gameState.turnoActual,
      });
    }
  }

  @SubscribeMessage('carta:ejecutar')
  async handleCartaEjecutar(
    @MessageBody() data: CartaEjecutarPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { partidaId, tipo } = data;

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }

    const jugadorId = this.obtenerSocketJugadorId(socket);
    if (!jugadorId || jugadorId !== gameState.jugadorActivoId) {
      socket.emit('error:accion', {
        codigo: 'NO_ES_TU_TURNO',
        mensaje: 'No es tu turno',
      });
      return;
    }

    const partida = await this.partidasService.obtener(partidaId);
    const room = `partida_${partida.codigo}`;

    const propiedadesRaw = await this.prisma.propiedad.findMany({
      where: { partidaId },
    });
    const propiedades = propiedadesRaw.map((p) => ({
      casas: p.casas,
      hotel: p.hotel,
      propietarioId: p.propietarioId,
    }));

    const carta = this.cartasService.extraerCarta(tipo);
    const resultado = this.cartasService.aplicarCarta(carta, jugadorId, gameState, propiedades);

    if (resultado.irACarcel) {
      this.server.to(room).emit('carcel:entrada', { jugadorId, motivo: 'CARTA' });
    }

    if (resultado.movimiento) {
      const { accion: accionCarta, propietarioId: pidCarta, monto: montoCarta, detalleAlquiler: detalleCarta } =
        await this.resolverAccionMovimiento(
          resultado.movimiento.posicionNueva,
          jugadorId,
          partidaId,
          resultado.gameState,
          0,
          0,
        );
      // Evitar que una carta dispare otra carta encadenada
      const accionFinal =
        accionCarta === 'CARTA_SUERTE' || accionCarta === 'CARTA_COMUNIDAD'
          ? 'LIBRE'
          : accionCarta;

      this.server.to(room).emit('tablero:movimiento', {
        jugadorId,
        posicionAnterior: resultado.movimiento.posicionAnterior,
        posicionNueva: resultado.movimiento.posicionNueva,
        dado1: 0,
        dado2: 0,
        dobles: false,
        accion: accionFinal,
        propietarioId: pidCarta,
        monto: montoCarta,
        detalleAlquiler: detalleCarta,
      });
    }

    for (const transaccion of resultado.transacciones) {
      await this.prisma.transaccion.create({
        data: {
          partidaId,
          jugadorId: transaccion.jugadorId,
          tipo: transaccion.tipo as import('@prisma/client').TipoTransaccion,
          monto: transaccion.monto,
          concepto: transaccion.concepto,
        },
      });
      this.server.to(room).emit('economia:transaccion', {
        jugadorId: transaccion.jugadorId,
        tipo: transaccion.tipo,
        monto: transaccion.monto,
        concepto: transaccion.concepto,
        saldoNuevo: resultado.gameState.jugadores[transaccion.jugadorId]?.saldo ?? 0,
      });
    }

    await this.guardarGameState(resultado.gameState);

    this.server.to(room).emit('carta:ejecutada', {
      jugadorId,
      tipo,
      efecto: carta.texto,
    });
  }

  @SubscribeMessage('carcel:pagarMulta')
  async handleCarcelPagarMulta(
    @MessageBody() data: CarcelPagarMultaPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { partidaId } = data;

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }

    const jugadorId = this.obtenerSocketJugadorId(socket);
    if (!jugadorId || jugadorId !== gameState.jugadorActivoId) {
      socket.emit('error:accion', {
        codigo: 'NO_ES_TU_TURNO',
        mensaje: 'No es tu turno',
      });
      return;
    }

    const estadoJugador = gameState.jugadores[jugadorId];
    if (!estadoJugador?.enCarcel) {
      socket.emit('error:accion', {
        codigo: 'NO_ESTA_EN_CARCEL',
        mensaje: 'No estás en la cárcel',
      });
      return;
    }

    if (estadoJugador.saldo < 50) {
      socket.emit('error:accion', {
        codigo: 'SALDO_INSUFICIENTE',
        mensaje: 'No tenés saldo suficiente para pagar la multa ($50)',
      });
      return;
    }

    estadoJugador.saldo -= 50;
    estadoJugador.enCarcel = false;
    estadoJugador.turnosEnCarcel = 0;

    await this.prisma.transaccion.create({
      data: {
        partidaId,
        jugadorId,
        tipo: 'IMPUESTO',
        monto: 50,
        concepto: 'Multa por salir de la cárcel',
      },
    });

    await this.guardarGameState(gameState);

    const partida = await this.partidasService.obtener(partidaId);
    const room = `partida_${partida.codigo}`;

    this.server.to(room).emit('carcel:salida', { jugadorId, metodo: 'PAGO' });
    this.server.to(room).emit('economia:transaccion', {
      jugadorId,
      tipo: 'IMPUESTO',
      monto: -50,
      concepto: 'Multa por salir de la cárcel',
      saldoNuevo: estadoJugador.saldo,
    });
  }

  @SubscribeMessage('carcel:usarCarta')
  async handleCarcelUsarCarta(
    @MessageBody() data: CarcelUsarCartaPayload,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { partidaId } = data;

    const gameState = await this.obtenerGameState(partidaId);
    if (!gameState) {
      socket.emit('error:accion', {
        codigo: 'PARTIDA_NO_ENCONTRADA',
        mensaje: 'Estado de partida no encontrado',
      });
      return;
    }

    const jugadorId = this.obtenerSocketJugadorId(socket);
    if (!jugadorId || jugadorId !== gameState.jugadorActivoId) {
      socket.emit('error:accion', {
        codigo: 'NO_ES_TU_TURNO',
        mensaje: 'No es tu turno',
      });
      return;
    }

    const estadoJugador = gameState.jugadores[jugadorId];
    if (!estadoJugador?.enCarcel || !estadoJugador.cartaSalida) {
      socket.emit('error:accion', {
        codigo: 'NO_PUEDE_USAR_CARTA',
        mensaje: 'No estás en la cárcel o no tenés carta de salida',
      });
      return;
    }

    estadoJugador.enCarcel = false;
    estadoJugador.turnosEnCarcel = 0;
    estadoJugador.cartaSalida = false;

    await this.guardarGameState(gameState);

    const partida = await this.partidasService.obtener(partidaId);
    const room = `partida_${partida.codigo}`;

    this.server.to(room).emit('carcel:salida', { jugadorId, metodo: 'CARTA' });
  }
}
