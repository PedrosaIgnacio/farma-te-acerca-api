import { Module } from '@nestjs/common';
import { EstadosController } from './estados.controller';
import { EstadosService } from './estados.service';

@Module({
  controllers: [EstadosController],
  providers: [EstadosService],
})
export class EstadosModule {}
