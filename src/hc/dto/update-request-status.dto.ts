import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { STATUS_LABELS } from '../../common/status.util';
import type { EstadoNombre } from '../../common/status.util';

export class UpdateRequestStatusDto {
  @ApiProperty({ enum: STATUS_LABELS })
  @IsIn(STATUS_LABELS)
  status: EstadoNombre;
}
