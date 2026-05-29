import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@support-hub/database';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService, CreateUserDto } from './users.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private service: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: any) {
    return this.service.findMe(user.id);
  }

  @Public()
  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }

  @Get('organization/:orgId')
  @Roles(UserRole.SUPPORT_AGENT)
  findByOrg(@Param('orgId') orgId: string) {
    return this.service.findAll(orgId);
  }
}
