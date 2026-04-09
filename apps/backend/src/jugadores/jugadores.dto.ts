import { IsEnum, IsString, MinLength, MaxLength } from 'class-validator';
import { Ficha } from '@prisma/client';

export class CrearJugadorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  nombre: string;

  @IsEnum(Ficha)
  ficha: Ficha;
}

export class JugadorResponseDto {
  jugadorId: string;
  nombre: string;
  ficha: string;
  ordenTurno: number;
}
