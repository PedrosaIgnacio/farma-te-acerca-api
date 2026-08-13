import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Legajo del colaborador.' })
  @IsString()
  @IsNotEmpty()
  legajo: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}
