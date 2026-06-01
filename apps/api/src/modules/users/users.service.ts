import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { IsString, IsEmail, MinLength, IsOptional, IsUrl } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

export class CreateUserDto {
  @IsEmail() email: string;
  @IsString() @MinLength(2) name: string;
  @IsString() @MinLength(8) password: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsUrl() avatarUrl?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(orgId: string) {
    return this.prisma.userOrganization.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, isActive: true, lastLoginAt: true } },
      },
    });
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    return user;
  }

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isMasterAdmin: true,
        createdAt: true,
        organizations: {
          include: { organization: true },
          where: { acceptedAt: { not: null } },
        },
      },
    });
    if (!user) throw new NotFoundException();
    return user;
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { ...dto },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
  }
}
