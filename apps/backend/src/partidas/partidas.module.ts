import { Module } from '@nestjs/common';
import { PartidasController } from './partidas.controller';
import { PartidasService } from './partidas.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [PartidasController],
  providers: [PartidasService],
  exports: [PartidasService],
})
export class PartidasModule {}
