import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ROLE_NAMES } from '../../auth/types';
import type { Role } from '../../auth/types';

// Creates both the Colaborador row and its Supabase Auth account (see
// HcService.createUser) — there's no password field here, a temporary one
// is generated server-side and returned once in the response.
export class CreateHcUserDto {
  @ApiProperty({ maxLength: 20 })
  @IsString()
  @MaxLength(20)
  legajo: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  nombre: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ required: false, maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiProperty({ enum: ROLE_NAMES })
  @IsIn(ROLE_NAMES)
  rol: Role;

  @ApiProperty({
    required: false,
    description: 'Sucursal a la que queda asignado.',
  })
  @IsOptional()
  @IsInt()
  sucursalId?: number;
}
