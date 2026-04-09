import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ModoMonetario, Ficha } from '@prisma/client';

export class CrearPartidaDto {
  @IsEnum(ModoMonetario)
  @IsOptional()
  modoMonetario?: ModoMonetario;
}

export class PartidaResponseDto {
  partidaId: string;
  codigo: string;
  estado: string;
  modoMonetario: string;
}

export class UnirsePartidaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  nombre: string;

  @IsEnum(Ficha)
  ficha: Ficha;
}

export class OrdenDadoItemDto {
  @IsString()
  jugadorId: string;

  @IsNumber()
  @Min(2)
  @Max(12)
  resultado: number;
}

export class IniciarPartidaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrdenDadoItemDto)
  ordenDados: OrdenDadoItemDto[];
}

export class JugadorEnSalaDto {
  jugadorId: string;
  nombre: string;
  ficha: string;
  ordenTurno: number;
}

export class PartidaDetalleDto {
  partidaId: string;
  codigo: string;
  estado: string;
  modoMonetario: string;
  jugadores: JugadorEnSalaDto[];
}

export class UnirseResponseDto {
  jugadorId: string;
  partida: PartidaDetalleDto;
}

export class PartidaResumenDto {
  partidaId: string;
  codigo: string;
  modoMonetario: string;
  creadaEn: string;
  duracionMinutos: number;
  cantidadJugadores: number;
  ganadorNombre: string | null;
  ganadorFicha: string | null;
}

export class TransaccionDetalleDto {
  tipo: string;
  monto: number;
  concepto: string;
  creadaEn: string;
  jugadorNombre: string;
}

export class PartidaDetalleCompletaDto {
  partidaId: string;
  codigo: string;
  modoMonetario: string;
  creadaEn: string;
  jugadores: { nombre: string; ficha: string; saldo: number; eliminado: boolean }[];
  transacciones: TransaccionDetalleDto[];
}

export class EstadisticasDto {
  totalPartidas: number;
  promedioJugadoresPorPartida: number;
  promedioDuracionMinutos: number;
  propiedadMasComprada: { casilla: number; nombre: string; veces: number } | null;
  modoMonetarioMasUsado: string | null;
}
