import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ROLE_NAMES } from '../../auth/types';
import type { Role } from '../../auth/types';

export class UpdateHcUserDto {
  @ApiProperty({ required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @ApiProperty({
    required: false,
    description:
      'Si cambia, también se actualiza el email de la cuenta en Supabase Auth.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiProperty({ required: false, enum: ROLE_NAMES })
  @IsOptional()
  @IsIn(ROLE_NAMES)
  rol?: Role;

  @ApiProperty({ required: false, description: 'Reasigna la sucursal actual.' })
  @IsOptional()
  @IsInt()
  sucursalId?: number;

  @ApiProperty({ required: false, description: 'Baja lógica del colaborador.' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
