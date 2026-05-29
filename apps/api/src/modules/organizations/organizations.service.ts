import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UserRole } from '@support-hub/database';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { projects: true, users: true } } },
    });
  }

  async findOne(id: string, userId: string, isMasterAdmin: boolean) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        projects: { where: { isActive: true } },
        _count: { select: { users: true } },
      },
    });

    if (!org) throw new NotFoundException('Organization not found');

    if (!isMasterAdmin) {
      const member = await this.prisma.userOrganization.findUnique({
        where: { userId_organizationId: { userId, organizationId: id } },
      });
      if (!member) throw new ForbiddenException();
    }

    return org;
  }

  async create(dto: CreateOrganizationDto) {
    const exists = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException('Slug already taken');

    return this.prisma.organization.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateOrganizationDto>) {
    await this.findById(id);
    return this.prisma.organization.update({ where: { id }, data: dto });
  }

  async inviteUser(orgId: string, email: string, role: UserRole) {
    await this.findById(orgId);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
    });
    if (existing) throw new ConflictException('User already in organization');

    return this.prisma.userOrganization.create({
      data: {
        userId: user.id,
        organizationId: orgId,
        role,
        acceptedAt: new Date(),
      },
    });
  }

  async removeUser(orgId: string, userId: string) {
    await this.prisma.userOrganization.deleteMany({
      where: { organizationId: orgId, userId },
    });
  }

  async updateUserRole(orgId: string, userId: string, role: UserRole) {
    return this.prisma.userOrganization.update({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      data: { role },
    });
  }

  private async findById(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }
}
