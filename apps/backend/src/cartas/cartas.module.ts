import { Module } from '@nestjs/common';
import { CartasService } from './cartas.service';

@Module({
  providers: [CartasService],
  exports: [CartasService],
})
export class CartasModule {}
