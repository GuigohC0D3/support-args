import { Controller, Get, Post, Patch, Body, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@support-hub/database';
import { diskStorage } from 'multer';
import { join } from 'path';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png',
  'image/gif': '.gif', 'image/webp': '.webp', 'image/avif': '.avif',
};
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService, CreateUserDto, UpdateProfileDto } from './users.service';
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

  @Patch('me')
  updateMe(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.service.updateMe(user.id, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'avatars'),
      filename: (req, file, cb) => cb(null, `${(req as any).user.id}${MIME_TO_EXT[file.mimetype] ?? '.jpg'}`),
    }),
    fileFilter: (_, file, cb) => {
      if (!file.mimetype.startsWith('image/')) return cb(new BadRequestException('Apenas imagens são permitidas'), false);
      cb(null, true);
    },
    limits: { fileSize: 2 * 1024 * 1024 },
  }))
  uploadAvatar(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    return this.service.updateMe(user.id, { avatarUrl } as any);
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
