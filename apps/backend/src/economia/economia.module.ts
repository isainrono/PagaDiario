import { Module } from '@nestjs/common';
import { EconomiaService } from './economia.service';

@Module({
  providers: [EconomiaService],
  exports: [EconomiaService],
})
export class EconomiaModule {}
