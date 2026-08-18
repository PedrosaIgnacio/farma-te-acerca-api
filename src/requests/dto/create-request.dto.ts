import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Motivo } from '../../../generated/prisma';

export class CreateRequestDto {
  @ApiProperty({
    description: 'Sucursal donde trabaja actualmente el colaborador.',
  })
  @IsInt()
  currentBranchId: number;

  @ApiProperty({ description: 'Sucursal a la que desea trasladarse.' })
  @IsInt()
  desiredBranchId: number;

  @ApiProperty({ enum: Motivo })
  @IsEnum(Motivo)
  reason: Motivo;

  @ApiProperty({ required: false, description: 'Solo cuando reason = "Otro".' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  otherReason?: string;

  @ApiProperty({ required: false, maxLength: 240 })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;
}
