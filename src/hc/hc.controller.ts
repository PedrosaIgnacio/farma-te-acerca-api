import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { HcRequestsQueryDto } from './dto/hc-requests-query.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { HcService } from './hc.service';

@ApiTags('hc')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('hc')
@Controller('hc')
export class HcController {
  constructor(private readonly hcService: HcService) {}

  @Get('requests')
  findRequests(@Query() query: HcRequestsQueryDto) {
    return this.hcService.findRequestsByDesiredBranch(query.desiredBranchId);
  }

  @Patch('requests/:id/status')
  updateRequestStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRequestStatusDto,
  ) {
    return this.hcService.updateRequestStatus(id, dto.status);
  }

  @Get('analytics')
  getAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.hcService.getAnalytics(query);
  }

  @Get('requests/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="solicitudes.csv"')
  async exportRequests(
    @Query() query: AnalyticsQueryDto,
  ): Promise<StreamableFile> {
    const csv = await this.hcService.exportCsv(query);
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }
}
