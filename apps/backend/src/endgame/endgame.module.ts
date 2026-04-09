import { Module } from '@nestjs/common';
import { EndgameService } from './endgame.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { TableroModule } from '../tablero/tablero.module';

@Module({
  imports: [PrismaModule, RedisModule, TableroModule],
  providers: [EndgameService],
  exports: [EndgameService],
})
export class EndgameModule {}
