import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { STATUS_LABELS } from '../../common/status.util';
import type { EstadoNombre } from '../../common/status.util';

export class UpdateRequestStatusDto {
  @ApiProperty({ enum: STATUS_LABELS })
  @IsIn(STATUS_LABELS)
  status: EstadoNombre;

  @ApiProperty({ description: 'Motivo del cambio de estado.', maxLength: 240 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  motivo: string;
}
