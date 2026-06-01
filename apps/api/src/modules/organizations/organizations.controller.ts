import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsEnum, IsEmail } from 'class-validator';
import { UserRole } from '@support-hub/database';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

class InviteUserDto {
  @IsEmail() email: string;
  @IsEnum(UserRole) role: UserRole;
}

class UpdateRoleDto {
  @IsEnum(UserRole) role: UserRole;
}

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private service: OrganizationsService) {}

  @Get()
  @Roles(UserRole.MASTER_ADMIN)
  @ApiOperation({ summary: 'List all organizations (master admin)' })
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles(UserRole.MASTER_ADMIN)
  create(@Body() dto: CreateOrganizationDto) {
    return this.service.create(dto);
  }

  @Get(':orgId')
  findOne(@Param('orgId') orgId: string, @CurrentUser() user: any) {
    return this.service.findOne(orgId, user.id, user.isMasterAdmin);
  }

  @Patch(':orgId')
  @Roles(UserRole.ORG_ADMIN)
  update(@Param('orgId') orgId: string, @Body() dto: Partial<CreateOrganizationDto>) {
    return this.service.update(orgId, dto);
  }

  @Post(':orgId/users/invite')
  @Roles(UserRole.ORG_ADMIN)
  invite(@Param('orgId') orgId: string, @Body() dto: InviteUserDto) {
    return this.service.inviteUser(orgId, dto.email, dto.role);
  }

  @Patch(':orgId/users/:userId/role')
  @Roles(UserRole.ORG_ADMIN)
  updateRole(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.service.updateUserRole(orgId, userId, dto.role);
  }

  @Get(':orgId/users')
  @ApiOperation({ summary: 'List organization members' })
  listMembers(@Param('orgId') orgId: string, @CurrentUser() user: any) {
    return this.service.listMembers(orgId, user.id, user.isMasterAdmin);
  }

  @Delete(':orgId/users/:userId')
  @Roles(UserRole.ORG_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeUser(@Param('orgId') orgId: string, @Param('userId') userId: string) {
    return this.service.removeUser(orgId, userId);
  }

  @Delete(':orgId')
  @Roles(UserRole.MASTER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate organization (master admin)' })
  deactivate(@Param('orgId') orgId: string) {
    return this.service.deactivate(orgId);
  }
}
