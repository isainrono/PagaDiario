import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PartidasService } from './partidas.service';
import {
  CrearPartidaDto,
  IniciarPartidaDto,
  PartidaDetalleDto,
  PartidaDetalleCompletaDto,
  PartidaResumenDto,
  PartidaResponseDto,
  EstadisticasDto,
  UnirsePartidaDto,
  UnirseResponseDto,
} from './partidas.dto';

@Controller('partidas')
export class PartidasController {
  constructor(private readonly partidasService: PartidasService) {}

  @Post()
  crear(@Body() dto: CrearPartidaDto): Promise<PartidaResponseDto> {
    return this.partidasService.crear(dto);
  }

  // IMPORTANT: static routes must come before :partidaId to avoid NestJS conflicts
  @Get('historial')
  obtenerHistorial(): Promise<PartidaResumenDto[]> {
    return this.partidasService.obtenerHistorial();
  }

  @Get('estadisticas')
  obtenerEstadisticas(): Promise<EstadisticasDto> {
    return this.partidasService.obtenerEstadisticas();
  }

  @Post(':codigo/unirse')
  unirse(
    @Param('codigo') codigo: string,
    @Body() dto: UnirsePartidaDto,
  ): Promise<UnirseResponseDto> {
    return this.partidasService.unirse(codigo, dto);
  }

  @Get(':partidaId')
  obtener(@Param('partidaId') partidaId: string): Promise<PartidaDetalleDto> {
    return this.partidasService.obtener(partidaId);
  }

  @Get(':partidaId/detalle')
  obtenerDetalleCompleto(
    @Param('partidaId') partidaId: string,
  ): Promise<PartidaDetalleCompletaDto> {
    return this.partidasService.obtenerDetalleCompleto(partidaId);
  }

  @Post(':partidaId/iniciar')
  iniciar(
    @Param('partidaId') partidaId: string,
    @Body() dto: IniciarPartidaDto,
  ): Promise<{ ordenTurnos: string[] }> {
    return this.partidasService.iniciar(partidaId, dto);
  }
}
