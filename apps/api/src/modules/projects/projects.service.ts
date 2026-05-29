import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

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
      where: { id: projectId, organizationId: orgId },
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
      data: { ...dto, organizationId: orgId },
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

  private async findById(orgId: string, projectId: string) {
    const p = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }
}
