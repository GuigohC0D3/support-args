import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { UserRole } from '@support-hub/database';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';

class AddMemberDto {
  @IsString() userId: string;
  @IsEnum(UserRole) role: UserRole;
}

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

  @Get(':projectId/members')
  @ApiOperation({ summary: 'List project members' })
  listMembers(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.listMembers(orgId, projectId, user.id, user.isMasterAdmin);
  }

  @Post(':projectId/members')
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Add member to project' })
  addMember(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.service.addMember(orgId, projectId, dto.userId, dto.role);
  }

  @Delete(':projectId/members/:userId')
  @Roles(UserRole.ORG_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from project' })
  removeMember(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.service.removeMember(orgId, projectId, userId);
  }
}
