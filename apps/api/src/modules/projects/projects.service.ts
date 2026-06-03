import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { UserRole } from '@support-hub/database';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { IntegrationsService } from '../integrations/integrations.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(orgId: string, userId: string, isMasterAdmin: boolean) {
    const where = isMasterAdmin
      ? { organizationId: orgId, isActive: true }
      : {
          organizationId: orgId,
          isActive: true,
          members: { some: { userId } },
        };

    return this.prisma.project.findMany({
      where,
      include: { _count: { select: { tickets: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(orgId: string, projectId: string, userId: string, isMasterAdmin: boolean) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, isActive: true },
      include: {
        slaPolicy: true,
        _count: { select: { tickets: true, members: true } },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    if (!isMasterAdmin) {
      const member = await this.prisma.userProject.findUnique({
        where: { userId_projectId: { userId, projectId } },
      });
      if (!member) throw new ForbiddenException();
    }

    return project;
  }

  async create(orgId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: { ...dto, organizationId: orgId, apiKey: IntegrationsService.generateApiKey() },
    });
  }

  async regenerateApiKey(orgId: string, projectId: string) {
    await this.findById(orgId, projectId);
    return this.prisma.project.update({
      where: { id: projectId },
      data:  { apiKey: IntegrationsService.generateApiKey() },
      select: { id: true, apiKey: true },
    });
  }

  async update(orgId: string, projectId: string, dto: Partial<CreateProjectDto>) {
    await this.findById(orgId, projectId);
    return this.prisma.project.update({ where: { id: projectId }, data: dto });
  }

  async remove(orgId: string, projectId: string) {
    await this.findById(orgId, projectId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { isActive: false },
    });
  }

  async listMembers(orgId: string, projectId: string, userId: string, isMasterAdmin: boolean) {
    const project = await this.findById(orgId, projectId);

    if (!isMasterAdmin) {
      const member = await this.prisma.userProject.findUnique({
        where: { userId_projectId: { userId, projectId: project.id } },
      });
      if (!member) throw new ForbiddenException();
    }

    return this.prisma.userProject.findMany({
      where: { projectId: project.id },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { addedAt: 'asc' },
    });
  }

  async addMember(orgId: string, projectId: string, userId: string, role: UserRole) {
    const project = await this.findById(orgId, projectId);

    const existing = await this.prisma.userProject.findUnique({
      where: { userId_projectId: { userId, projectId: project.id } },
    });
    if (existing) throw new ConflictException('User already in project');

    const orgMember = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
    if (!orgMember) throw new ForbiddenException('User is not a member of this organization');

    return this.prisma.userProject.create({
      data: { userId, projectId: project.id, role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async removeMember(orgId: string, projectId: string, userId: string) {
    const project = await this.findById(orgId, projectId);
    await this.prisma.userProject.deleteMany({ where: { projectId: project.id, userId } });
  }

  private async findById(orgId: string, projectId: string) {
    const p = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }
}
