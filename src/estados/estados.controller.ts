import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EstadosService } from './estados.service';

@ApiTags('estados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('estados')
export class EstadosController {
  constructor(private readonly estadosService: EstadosService) {}

  @Get()
  findActive() {
    return this.estadosService.findActive();
  }
}
