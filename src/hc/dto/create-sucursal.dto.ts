import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSucursalDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  nombre: string;

  @ApiProperty({ description: 'Provincia donde se ubica la sucursal.' })
  @IsInt()
  provinciaId: number;

  @ApiProperty({
    required: false,
    description:
      'Necesaria para que la sucursal aparezca en "colaboradores cercanos" de DT.',
  })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  lng?: number;
}
