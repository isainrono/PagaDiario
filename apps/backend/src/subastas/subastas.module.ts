import { Module } from '@nestjs/common';
import { SubastasService } from './subastas.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [SubastasService],
  exports: [SubastasService],
})
export class SubastasModule {}
