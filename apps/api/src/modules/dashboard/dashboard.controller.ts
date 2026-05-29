import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { UserRole } from '@support-hub/database';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

class OrgQuery {
  @IsString() organizationId: string;
}

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPPORT_AGENT)
@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('metrics')
  getMetrics(@Query() q: OrgQuery) {
    return this.service.getMetrics(q.organizationId);
  }

  @Get('by-project')
  getByProject(@Query() q: OrgQuery) {
    return this.service.getByProject(q.organizationId);
  }

  @Get('sla')
  getSLA(@Query() q: OrgQuery) {
    return this.service.getSLACompliance(q.organizationId);
  }
}
