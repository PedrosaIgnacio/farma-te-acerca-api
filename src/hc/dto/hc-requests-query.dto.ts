import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

// All filters are optional: with none set, findRequests returns every
// solicitud. New filter criteria (estado, región, etc.) should be added
// here the same way, following AnalyticsQueryDto's pattern.
export class HcRequestsQueryDto {
  @ApiProperty({
    required: false,
    description: 'Sucursal a la que los colaboradores solicitan trasladarse.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  desiredBranchId?: number;
}
