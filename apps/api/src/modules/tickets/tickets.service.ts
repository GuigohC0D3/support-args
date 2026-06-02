import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, HistoryAction, TicketStatus, UserRole, CommentType } from '@support-hub/database';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { IntegrationsService } from '../integrations/integrations.service';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private integrations: IntegrationsService,
  ) {}

  async findAll(dto: ListTicketsDto, userId: string, isMasterAdmin: boolean, userRole?: string) {
    const { organizationId, projectId, status, priority, assignedToId, search, page = 1, limit = 20 } = dto;

    const where: any = {};

    if (organizationId) where.organizationId = organizationId;
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedToId) where.assignedToId = assignedToId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Clientes só veem seus próprios tickets
    if (!isMasterAdmin && userRole === UserRole.CLIENT) {
      where.createdById = userId;
    }

    const [data, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
          project: { select: { id: true, name: true, color: true } },
          _count: { select: { comments: true, attachments: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, userId: string, isMasterAdmin: boolean, userRole?: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
        project: true,
        tags: true,
        attachments: true,
        comments: {
          where: userRole === UserRole.CLIENT ? { type: CommentType.PUBLIC } : {},
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        history: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    if (!isMasterAdmin && userRole === UserRole.CLIENT && ticket.createdById !== userId) {
      throw new ForbiddenException();
    }

    return ticket;
  }

  async create(dto: CreateTicketDto, organizationId: string, userId: string) {
    const lastTicket = await this.prisma.ticket.findFirst({
      where: { organizationId },
      orderBy: { number: 'desc' },
      select: { number: true },
    });

    const number = (lastTicket?.number ?? 0) + 1;

    const ticket = await this.prisma.ticket.create({
      data: {
        number,
        organizationId,
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        category: dto.category,
        impactData: (dto.impactData as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        userId,
        action: HistoryAction.CREATED,
        newValue: JSON.stringify({ status: ticket.status, priority: ticket.priority }),
      },
    });

    // Dispara notificação para agentes/admins da org (sem await para não bloquear resposta)
    this.notifications.onTicketCreated({
      id:             ticket.id,
      number:         ticket.number,
      title:          ticket.title,
      organizationId: organizationId,
      createdById:    userId,
    }).catch(() => null);

    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto, userId: string, isMasterAdmin = false) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    let userRole: string | null = null;
    if (!isMasterAdmin) {
      const membership = await this.prisma.userOrganization.findUnique({
        where: { userId_organizationId: { userId, organizationId: ticket.organizationId } },
        select: { role: true },
      });
      if (!membership) throw new ForbiddenException();
      userRole = membership.role;
    }

    const historyEntries: { action: HistoryAction; oldValue?: string; newValue?: string }[] = [];

    const data: any = {};

    if (dto.status && dto.status !== ticket.status) {
      historyEntries.push({
        action: HistoryAction.STATUS_CHANGED,
        oldValue: ticket.status,
        newValue: dto.status,
      });
      data.status = dto.status;

      if (dto.status === TicketStatus.RESOLVED) data.resolvedAt = new Date();
      if (dto.status === TicketStatus.CLOSED) data.closedAt = new Date();

      if (dto.status === TicketStatus.IN_PROGRESS && !ticket.assignedToId && !('assignedToId' in dto)) {
        const canBeAssigned = isMasterAdmin || (([UserRole.SUPPORT_AGENT, UserRole.ORG_ADMIN] as UserRole[]).includes(userRole as UserRole));
        if (canBeAssigned) {
          historyEntries.push({ action: HistoryAction.ASSIGNED, newValue: userId });
          data.assignedToId = userId;
        }
      }
    }

    if (dto.priority && dto.priority !== ticket.priority) {
      historyEntries.push({
        action: HistoryAction.PRIORITY_CHANGED,
        oldValue: ticket.priority,
        newValue: dto.priority,
      });
      data.priority = dto.priority;
    }

    if ('assignedToId' in dto && dto.assignedToId !== ticket.assignedToId) {
      historyEntries.push({
        action: dto.assignedToId ? HistoryAction.ASSIGNED : HistoryAction.UNASSIGNED,
        oldValue: ticket.assignedToId ?? undefined,
        newValue: dto.assignedToId ?? undefined,
      });
      data.assignedToId = dto.assignedToId;
    }

    if (dto.title) data.title = dto.title;
    if (dto.description) data.description = dto.description;

    const updated = await this.prisma.ticket.update({ where: { id }, data });

    if (historyEntries.length > 0) {
      await this.prisma.ticketHistory.createMany({
        data: historyEntries.map((h) => ({ ...h, ticketId: id, userId })),
      });
    }

    // Email ao cliente (ticket de integração) quando status muda
    if (dto.status && dto.status !== ticket.status) {
      this.integrations.notifyClientStatusChanged(id, dto.status).catch(() => null);
    }

    // Notificações de mudança de status
    if (dto.status && dto.status !== ticket.status) {
      this.notifications.onStatusChanged(
        { id: ticket.id, number: ticket.number, title: ticket.title, createdById: ticket.createdById, organizationId: ticket.organizationId },
        dto.status,
        userId,
      ).catch(() => null);
    }

    // Notificação de atribuição
    if (dto.assignedToId && dto.assignedToId !== ticket.assignedToId) {
      this.notifications.onTicketAssigned(
        { id: ticket.id, number: ticket.number, title: ticket.title },
        dto.assignedToId,
        userId,
      ).catch(() => null);
    }

    return updated;
  }

  async addComment(ticketId: string, dto: CreateCommentDto, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const comment = await this.prisma.ticketComment.create({
      data: {
        ticketId,
        userId,
        body: dto.body,
        type: dto.type ?? CommentType.PUBLIC,
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    // Registra primeira resposta do agente/admin
    if (!ticket.firstResponseAt) {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { firstResponseAt: new Date() },
      });
    }

    await this.prisma.ticketHistory.create({
      data: {
        ticketId,
        userId,
        action: HistoryAction.COMMENTED,
        newValue: JSON.stringify({ commentId: comment.id, type: comment.type }),
      },
    });

    // Email ao cliente se foi um agente que respondeu
    if (comment.type === CommentType.PUBLIC) {
      this.integrations.notifyClientNewReply({
        ticketId:  ticketId,
        agentName: comment.user.name,
        preview:   dto.body,
      }).catch(() => null);
    }

    this.notifications.onNewComment(
      {
        id:             ticketId,
        number:         ticket.number,
        title:          ticket.title,
        createdById:    ticket.createdById,
        assignedToId:   ticket.assignedToId,
        organizationId: ticket.organizationId,
      },
      userId,
      comment.type === CommentType.INTERNAL,
    ).catch(() => null);

    return comment;
  }

  async addAttachments(ticketId: string, files: Express.Multer.File[], userId: string, isMasterAdmin = false) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (!isMasterAdmin) {
      const membership = await this.prisma.userOrganization.findUnique({
        where: { userId_organizationId: { userId, organizationId: ticket.organizationId } },
      });
      if (!membership) throw new ForbiddenException();
    }

    return this.prisma.ticketAttachment.createMany({
      data: files.map((f) => ({
        ticketId,
        uploadedById: userId,
        fileName: f.originalname,
        fileSize: f.size,
        mimeType: f.mimetype,
        storageKey: `/uploads/attachments/${ticketId}/${f.filename}`,
      })),
    });
  }

  async getHistory(ticketId: string, userId: string, isMasterAdmin = false) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId }, select: { organizationId: true } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (!isMasterAdmin) {
      const membership = await this.prisma.userOrganization.findUnique({
        where: { userId_organizationId: { userId, organizationId: ticket.organizationId } },
      });
      if (!membership) throw new ForbiddenException();
    }

    return this.prisma.ticketHistory.findMany({
      where: { ticketId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
