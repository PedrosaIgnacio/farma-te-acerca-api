import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ESTADO_CODIGOS } from '../../common/status.util';
import type { EstadoCodigo } from '../../common/status.util';

export class UpdateRequestStatusDto {
  // The stable business key (e.g. "EN_CURSO"), not the renamable display
  // name — see status.util.ts's ESTADO_CODIGOS doc comment for why.
  @ApiProperty({ enum: ESTADO_CODIGOS })
  @IsIn(ESTADO_CODIGOS)
  codigo: EstadoCodigo;

  @ApiProperty({ description: 'Motivo del cambio de estado.', maxLength: 240 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  motivo: string;
}
