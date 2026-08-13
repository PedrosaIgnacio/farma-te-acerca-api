import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class HcRequestsQueryDto {
  @ApiProperty({
    description: 'Sucursal a la que los colaboradores solicitan trasladarse.',
  })
  @Type(() => Number)
  @IsInt()
  desiredBranchId: number;
}
