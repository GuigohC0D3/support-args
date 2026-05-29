import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@support-hub/database';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations/:orgId/projects')
export class ProjectsController {
  constructor(private service: ProjectsService) {}

  @Get()
  findAll(@Param('orgId') orgId: string, @CurrentUser() user: any) {
    return this.service.findAll(orgId, user.id, user.isMasterAdmin);
  }

  @Get(':projectId')
  findOne(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.findOne(orgId, projectId, user.id, user.isMasterAdmin);
  }

  @Post()
  @Roles(UserRole.ORG_ADMIN)
  create(@Param('orgId') orgId: string, @Body() dto: CreateProjectDto) {
    return this.service.create(orgId, dto);
  }

  @Patch(':projectId')
  @Roles(UserRole.ORG_ADMIN)
  update(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: Partial<CreateProjectDto>,
  ) {
    return this.service.update(orgId, projectId, dto);
  }

  @Delete(':projectId')
  @Roles(UserRole.ORG_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('orgId') orgId: string, @Param('projectId') projectId: string) {
    return this.service.remove(orgId, projectId);
  }
}
