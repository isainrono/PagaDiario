import { Module } from '@nestjs/common';
import { TableroService } from './tablero.service';

@Module({
  providers: [TableroService],
  exports: [TableroService],
})
export class TableroModule {}
