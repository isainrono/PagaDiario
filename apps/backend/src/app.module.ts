import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { PartidasModule } from './partidas/partidas.module';
import { JugadoresModule } from './jugadores/jugadores.module';
import { RedisModule } from './redis/redis.module';
import { TableroModule } from './tablero/tablero.module';
import { EconomiaModule } from './economia/economia.module';
import { SubastasModule } from './subastas/subastas.module';
import { NegociacionesModule } from './negociaciones/negociaciones.module';
import { EndgameModule } from './endgame/endgame.module';
import { CartasModule } from './cartas/cartas.module';
import { HealthController } from './health/health.controller';
import { GameGateway } from './gateway/game.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PartidasModule,
    JugadoresModule,
    RedisModule,
    TableroModule,
    EconomiaModule,
    SubastasModule,
    NegociacionesModule,
    EndgameModule,
    CartasModule,
  ],
  controllers: [HealthController],
  providers: [GameGateway],
})
export class AppModule {}
