import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ModoMonetario } from '@prisma/client';
import { GameState } from '@pagadiario/types';
import { TABLERO } from '../tablero/tablero.data';
import {
  CrearPartidaDto,
  PartidaResponseDto,
  UnirsePartidaDto,
  UnirseResponseDto,
  IniciarPartidaDto,
  PartidaDetalleDto,
  JugadorEnSalaDto,
  PartidaResumenDto,
  PartidaDetalleCompletaDto,
  TransaccionDetalleDto,
  EstadisticasDto,
} from './partidas.dto';

const NOMBRES_CASILLAS: string[] = [
  'Salida', 'Mediterráneo', 'Caja Comunidad', 'Báltico', 'Impuesto renta',
  'FC Reading', 'Oriental', 'Suerte', 'Vermont', 'Connecticut',
  'Cárcel', 'St. Charles', 'Cía. Eléctrica', 'States', 'Virginia',
  'FC Pennsylvania', 'St. James', 'Caja Comunidad', 'Tennessee', 'New York',
  'Parking', 'Kentucky', 'Suerte', 'Indiana', 'Illinois',
  'FC B&O', 'Atlantic', 'Ventnor', 'Cía. Agua', 'Marvin Gardens',
  'Ve a la Cárcel', 'Pacific', 'North Carolina', 'Caja Comunidad', 'Pennsylvania',
  'FC Short Line', 'Suerte', 'Park Place', 'Impuesto lujo', 'Boardwalk',
];

@Injectable()
export class PartidasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async crear(dto: CrearPartidaDto): Promise<PartidaResponseDto> {
    const codigo = this.generarCodigo();
    const partida = await this.prisma.partida.create({
      data: {
        codigo,
        modoMonetario: dto.modoMonetario ?? ModoMonetario.DIGITAL,
      },
    });
    return {
      partidaId: partida.id,
      codigo: partida.codigo,
      estado: partida.estado,
      modoMonetario: partida.modoMonetario,
    };
  }

  async unirse(
    codigo: string,
    dto: UnirsePartidaDto,
  ): Promise<UnirseResponseDto> {
    const partida = await this.prisma.partida.findUnique({
      where: { codigo },
      include: { jugadores: true },
    });

    if (!partida) {
      throw new NotFoundException('Partida no encontrada');
    }

    if (partida.estado !== 'ESPERANDO') {
      throw new BadRequestException('La partida ya inició');
    }

    if (partida.jugadores.length >= 8) {
      throw new BadRequestException('Sala llena');
    }

    const fichaOcupada = partida.jugadores.some((j) => j.ficha === dto.ficha);
    if (fichaOcupada) {
      throw new BadRequestException('Ficha no disponible');
    }

    const ordenTurno = partida.jugadores.length;

    const jugador = await this.prisma.jugador.create({
      data: {
        partidaId: partida.id,
        nombre: dto.nombre,
        ficha: dto.ficha,
        ordenTurno,
      },
    });

    const jugadoresActualizados = await this.prisma.jugador.findMany({
      where: { partidaId: partida.id },
      orderBy: { ordenTurno: 'asc' },
    });

    const jugadoresDto: JugadorEnSalaDto[] = jugadoresActualizados.map((j) => ({
      jugadorId: j.id,
      nombre: j.nombre,
      ficha: j.ficha,
      ordenTurno: j.ordenTurno,
    }));

    return {
      jugadorId: jugador.id,
      partida: {
        partidaId: partida.id,
        codigo: partida.codigo,
        estado: partida.estado,
        modoMonetario: partida.modoMonetario,
        jugadores: jugadoresDto,
      },
    };
  }

  async obtener(partidaId: string): Promise<PartidaDetalleDto> {
    const partida = await this.prisma.partida.findUnique({
      where: { id: partidaId },
      include: {
        jugadores: { orderBy: { ordenTurno: 'asc' } },
      },
    });

    if (!partida) {
      throw new NotFoundException('Partida no encontrada');
    }

    const jugadoresDto: JugadorEnSalaDto[] = partida.jugadores.map((j) => ({
      jugadorId: j.id,
      nombre: j.nombre,
      ficha: j.ficha,
      ordenTurno: j.ordenTurno,
    }));

    return {
      partidaId: partida.id,
      codigo: partida.codigo,
      estado: partida.estado,
      modoMonetario: partida.modoMonetario,
      jugadores: jugadoresDto,
    };
  }

  async iniciar(
    partidaId: string,
    dto: IniciarPartidaDto,
  ): Promise<{ ordenTurnos: string[] }> {
    const partida = await this.prisma.partida.findUnique({
      where: { id: partidaId },
      include: { jugadores: true },
    });

    if (!partida) {
      throw new NotFoundException('Partida no encontrada');
    }

    if (partida.estado !== 'ESPERANDO') {
      throw new BadRequestException('La partida ya inició');
    }

    if (partida.jugadores.length < 2) {
      throw new BadRequestException('Se necesitan al menos 2 jugadores');
    }

    const ordenado = [...dto.ordenDados].sort(
      (a, b) => b.resultado - a.resultado,
    );

    await Promise.all(
      ordenado.map((item, index) =>
        this.prisma.jugador.update({
          where: { id: item.jugadorId },
          data: { ordenTurno: index },
        }),
      ),
    );

    await this.prisma.partida.update({
      where: { id: partidaId },
      data: { estado: 'EN_CURSO' },
    });

    const casillasBuy = TABLERO.filter(
      (c) => c.tipo === 'PROPIEDAD' || c.tipo === 'FERROCARRIL' || c.tipo === 'SERVICIO',
    );

    await this.prisma.propiedad.createMany({
      data: casillasBuy.map((c) => ({
        partidaId,
        casilla: c.posicion,
        propietarioId: null,
        casas: 0,
        hotel: false,
        hipotecada: false,
      })),
    });

    const jugadoresOrdenados = await this.prisma.jugador.findMany({
      where: { partidaId },
      orderBy: { ordenTurno: 'asc' },
    });

    const jugadoresState: GameState['jugadores'] = {};
    for (const j of jugadoresOrdenados) {
      jugadoresState[j.id] = {
        posicion: 0,
        saldo: 1500,
        enCarcel: false,
        turnosEnCarcel: 0,
        cartaSalida: false,
        eliminado: false,
      };
    }

    const jugadorActivoId = jugadoresOrdenados[0].id;

    const gameState: GameState = {
      partidaId,
      estado: 'EN_CURSO',
      turnoActual: 1,
      jugadorActivoId,
      dobles: 0,
      jugadores: jugadoresState,
      casas: 32,
      hoteles: 12,
      subastaActiva: null,
    };

    await this.redis.set(
      `game:${partidaId}`,
      JSON.stringify(gameState),
      86400,
    );

    return {
      ordenTurnos: ordenado.map((item) => item.jugadorId),
    };
  }

  async obtenerPorCodigo(codigo: string): Promise<PartidaDetalleDto> {
    const partida = await this.prisma.partida.findUnique({
      where: { codigo },
      include: {
        jugadores: { orderBy: { ordenTurno: 'asc' } },
      },
    });

    if (!partida) {
      throw new NotFoundException('Partida no encontrada');
    }

    const jugadoresDto: JugadorEnSalaDto[] = partida.jugadores.map((j) => ({
      jugadorId: j.id,
      nombre: j.nombre,
      ficha: j.ficha,
      ordenTurno: j.ordenTurno,
    }));

    return {
      partidaId: partida.id,
      codigo: partida.codigo,
      estado: partida.estado,
      modoMonetario: partida.modoMonetario,
      jugadores: jugadoresDto,
    };
  }

  async obtenerHistorial(): Promise<PartidaResumenDto[]> {
    const partidas = await this.prisma.partida.findMany({
      where: { estado: 'FINALIZADA' },
      include: { jugadores: { orderBy: { ordenTurno: 'asc' } } },
      orderBy: { creadaEn: 'desc' },
      take: 20,
    });

    return partidas.map((partida) => {
      const duracionMinutos = Math.round(
        (partida.actualizadaEn.getTime() - partida.creadaEn.getTime()) / 60000,
      );

      const jugadoresActivos = partida.jugadores.filter((j) => !j.eliminado);
      let ganadorNombre: string | null = null;
      let ganadorFicha: string | null = null;

      if (jugadoresActivos.length === 1) {
        ganadorNombre = jugadoresActivos[0].nombre;
        ganadorFicha = jugadoresActivos[0].ficha;
      } else if (jugadoresActivos.length > 1) {
        const ganador = jugadoresActivos.reduce((prev, curr) =>
          curr.ordenTurno < prev.ordenTurno ? curr : prev,
        );
        ganadorNombre = ganador.nombre;
        ganadorFicha = ganador.ficha;
      }

      return {
        partidaId: partida.id,
        codigo: partida.codigo,
        modoMonetario: partida.modoMonetario,
        creadaEn: partida.creadaEn.toISOString(),
        duracionMinutos,
        cantidadJugadores: partida.jugadores.length,
        ganadorNombre,
        ganadorFicha,
      };
    });
  }

  async obtenerDetalleCompleto(
    partidaId: string,
  ): Promise<PartidaDetalleCompletaDto> {
    const partida = await this.prisma.partida.findUnique({
      where: { id: partidaId },
      include: {
        jugadores: { orderBy: { ordenTurno: 'asc' } },
        transacciones: {
          include: { jugador: true },
          orderBy: { creadaEn: 'asc' },
        },
      },
    });

    if (!partida) {
      throw new NotFoundException('Partida no encontrada');
    }

    const transaccionesDto: TransaccionDetalleDto[] = partida.transacciones.map(
      (t) => ({
        tipo: t.tipo,
        monto: t.monto,
        concepto: t.concepto,
        creadaEn: t.creadaEn.toISOString(),
        jugadorNombre: t.jugador.nombre,
      }),
    );

    return {
      partidaId: partida.id,
      codigo: partida.codigo,
      modoMonetario: partida.modoMonetario,
      creadaEn: partida.creadaEn.toISOString(),
      jugadores: partida.jugadores.map((j) => ({
        nombre: j.nombre,
        ficha: j.ficha,
        saldo: j.saldo,
        eliminado: j.eliminado,
      })),
      transacciones: transaccionesDto,
    };
  }

  async obtenerEstadisticas(): Promise<EstadisticasDto> {
    const partidas = await this.prisma.partida.findMany({
      where: { estado: 'FINALIZADA' },
      include: { jugadores: true },
    });

    const totalPartidas = partidas.length;

    const promedioJugadoresPorPartida =
      totalPartidas === 0
        ? 0
        : partidas.reduce((sum, p) => sum + p.jugadores.length, 0) /
          totalPartidas;

    const promedioDuracionMinutos =
      totalPartidas === 0
        ? 0
        : partidas.reduce(
            (sum, p) =>
              sum +
              (p.actualizadaEn.getTime() - p.creadaEn.getTime()) / 60000,
            0,
          ) / totalPartidas;

    // Propiedad más comprada: casilla con más registros en Propiedad con propietarioId !== null
    const propiedadesAgrupadas = await this.prisma.propiedad.groupBy({
      by: ['casilla'],
      where: { propietarioId: { not: null } },
      _count: { casilla: true },
      orderBy: { _count: { casilla: 'desc' } },
      take: 1,
    });

    let propiedadMasComprada: EstadisticasDto['propiedadMasComprada'] = null;
    if (propiedadesAgrupadas.length > 0) {
      const top = propiedadesAgrupadas[0];
      propiedadMasComprada = {
        casilla: top.casilla,
        nombre: NOMBRES_CASILLAS[top.casilla] ?? `Casilla ${top.casilla}`,
        veces: top._count.casilla,
      };
    }

    // Modo monetario más usado entre FINALIZADAS
    let modoMonetarioMasUsado: string | null = null;
    if (totalPartidas > 0) {
      const conteoModos: Record<string, number> = {};
      for (const p of partidas) {
        conteoModos[p.modoMonetario] = (conteoModos[p.modoMonetario] ?? 0) + 1;
      }
      modoMonetarioMasUsado = Object.entries(conteoModos).reduce((a, b) =>
        b[1] > a[1] ? b : a,
      )[0];
    }

    return {
      totalPartidas,
      promedioJugadoresPorPartida: Math.round(promedioJugadoresPorPartida * 10) / 10,
      promedioDuracionMinutos: Math.round(promedioDuracionMinutos),
      propiedadMasComprada,
      modoMonetarioMasUsado,
    };
  }

  private generarCodigo(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join('');
  }
}
