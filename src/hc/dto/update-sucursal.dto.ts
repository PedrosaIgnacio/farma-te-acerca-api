import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Hand-written all-optional variant of CreateSucursalDto (no PartialType —
// not used elsewhere in this codebase, DTOs here are written explicitly).
export class UpdateSucursalDto {
  @ApiProperty({ required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  provinciaId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiProperty({ required: false, description: 'Baja lógica de la sucursal.' })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
