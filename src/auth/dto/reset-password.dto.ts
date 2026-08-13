import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: '6-digit code sent by email.' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
