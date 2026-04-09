import { Module } from '@nestjs/common';
import { NegociacionesService } from './negociaciones.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [NegociacionesService],
  exports: [NegociacionesService],
})
export class NegociacionesModule {}
