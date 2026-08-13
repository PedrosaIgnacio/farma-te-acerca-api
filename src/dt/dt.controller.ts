import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { NearbyEmployeesQueryDto } from './dto/nearby-employees-query.dto';
import { DtService } from './dt.service';

@ApiTags('dt')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('dt')
@Controller('dt')
export class DtController {
  constructor(private readonly dtService: DtService) {}

  @Get('nearby-employees')
  findNearby(@Query() query: NearbyEmployeesQueryDto) {
    return this.dtService.findNearby(query.branchId);
  }
}
