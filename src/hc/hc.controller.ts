import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { CreateHcRequestDto } from './dto/create-hc-request.dto';
import { CreateHcUserDto } from './dto/create-hc-user.dto';
import { CreateSucursalDto } from './dto/create-sucursal.dto';
import { UpdateHcUserDto } from './dto/update-hc-user.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { UpdateSucursalDto } from './dto/update-sucursal.dto';
import { HcService } from './hc.service';

@ApiTags('hc')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('hc')
@Controller('hc')
export class HcController {
  constructor(private readonly hcService: HcService) {}

  @Get('collaborators')
  findCollaborators() {
    return this.hcService.findCollaborators();
  }

  @Get('branches')
  findBranches() {
    return this.hcService.findBranches();
  }

  @Post('branches')
  createBranch(@Body() dto: CreateSucursalDto) {
    return this.hcService.createBranch(dto);
  }

  @Patch('branches/:id')
  updateBranch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSucursalDto,
  ) {
    return this.hcService.updateBranch(id, dto);
  }

  @Get('provincias')
  findProvincias() {
    return this.hcService.findProvincias();
  }

  @Get('users')
  findUsers() {
    return this.hcService.findUsers();
  }

  @Post('users')
  createUser(@Body() dto: CreateHcUserDto) {
    return this.hcService.createUser(dto);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateHcUserDto) {
    return this.hcService.updateUser(id, dto);
  }

  @Get('requests')
  findRequests(@Query() query: HcRequestsQueryDto) {
    return this.hcService.findRequests(query);
  }

  @Post('requests')
  createRequest(@Body() dto: CreateHcRequestDto) {
    return this.hcService.createRequest(dto);
  }

  @Patch('requests/:id/status')
  updateRequestStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRequestStatusDto,
  ) {
    return this.hcService.updateRequestStatus(id, dto.codigo, dto.motivo);
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
