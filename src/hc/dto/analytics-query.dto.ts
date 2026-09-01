import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';
import { ESTADO_CODIGOS } from '../../common/status.util';

export class AnalyticsQueryDto {
  @ApiProperty({
    required: false,
    description: 'Región de la sucursal deseada.',
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  desiredBranchId?: number;

  @ApiProperty({ required: false, enum: ESTADO_CODIGOS })
  @IsOptional()
  @IsIn(ESTADO_CODIGOS)
  estado?: string;

  @ApiProperty({
    required: false,
    description: 'ISO date, inclusive lower bound on fecha.',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiProperty({
    required: false,
    description: 'ISO date, inclusive upper bound on fecha.',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
