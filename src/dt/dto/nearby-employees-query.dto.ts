import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class NearbyEmployeesQueryDto {
  @ApiProperty({
    description: 'Sucursal para la que se buscan colaboradores cercanos.',
  })
  @Type(() => Number)
  @IsInt()
  branchId: number;
}
