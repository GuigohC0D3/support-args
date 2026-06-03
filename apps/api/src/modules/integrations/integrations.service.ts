import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { UserRole, CommentType } from '@support-hub/database';

export interface IntegrationTicketDto {
  apiKey:  string;
  user:    { email: string; name: string };
  ticket:  { title: string; description: string; category?: string };
}

@Injectable()
export class IntegrationsService {
  constructor(
    private prisma: PrismaService,
    private mail:   MailService,
  ) {}

  static generateApiKey(): string {
    return `sk_proj_${randomBytes(24).toString('hex')}`;
  }

  private static generateTrackingToken(): string {
    return randomBytes(32).toString('hex');
  }

  // ─── Info do projeto por API key (para o widget) ─────────────────────────────

  async getProjectByKey(apiKey: string) {
    const project = await this.prisma.project.findUnique({
      where:  { apiKey },
      select: {
        id: true, name: true, color: true,
        organization: { select: { id: true, name: true } },
      },
    });
    if (!project) throw new UnauthorizedException('Invalid API key');
    return project;
  }

  // ─── Criar ticket via integração ─────────────────────────────────────────────

  async createTicket(dto: IntegrationTicketDto) {
    const project = await this.prisma.project.findUnique({
      where:  { apiKey: dto.apiKey },
      select: { id: true, organizationId: true, name: true, isActive: true },
    });
    if (!project || !project.isActive) throw new UnauthorizedException('Invalid or inactive API key');

    const { id: projectId, organizationId } = project;

    // Busca ou cria o usuário
    let user = await this.prisma.user.findUnique({ where: { email: dto.user.email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email:        dto.user.email,
          name:         dto.user.name,
          passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
        },
      });
    }

    // Vincula à org (sem rebaixar)
    const orgMembership = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId } },
    });
    if (!orgMembership) {
      await this.prisma.userOrganization.create({
        data: { userId: user.id, organizationId, role: UserRole.CLIENT, acceptedAt: new Date() },
      });
    }

    // Vincula ao projeto
    const projectMembership = await this.prisma.userProject.findUnique({
      where: { userId_projectId: { userId: user.id, projectId } },
    });
    if (!projectMembership) {
      await this.prisma.userProject.create({ data: { userId: user.id, projectId, role: UserRole.CLIENT } });
    }

    // Número sequencial
    const lastTicket = await this.prisma.ticket.findFirst({
      where: { organizationId }, orderBy: { number: 'desc' }, select: { number: true },
    });
    const number = (lastTicket?.number ?? 0) + 1;

    // Cria o ticket com tracking token
    const trackingToken = IntegrationsService.generateTrackingToken();

    const ticket = await this.prisma.ticket.create({
      data: {
        number,
        organizationId,
        projectId,
        title:         dto.ticket.title,
        description:   dto.ticket.description,
        category:      (dto.ticket.category as any) ?? null,
        createdById:   user.id,
        trackingToken,
      },
      select: { id: true, number: true, status: true, createdAt: true, project: { select: { name: true } } },
    });

    // Envia email de confirmação (sem bloquear a resposta)
    this.mail.sendTicketCreated({
      to:            user.email,
      name:          user.name,
      ticketNumber:  ticket.number,
      ticketTitle:   dto.ticket.title,
      projectName:   project.name,
      trackingToken,
    }).catch(() => null);

    return {
      ticketId:      ticket.id,
      ticketNumber:  ticket.number,
      trackingToken,
      trackingUrl:   `/track/${trackingToken}`,
      status:        ticket.status,
      project:       ticket.project.name,
      createdAt:     ticket.createdAt,
    };
  }

  // ─── Rastreamento público ────────────────────────────────────────────────────

  async getTrackedTicket(token: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where:   { trackingToken: token },
      include: {
        project:  { select: { name: true, color: true } },
        createdBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
        comments: {
          where:   { type: CommentType.PUBLIC },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    return ticket;
  }

  async addTrackedComment(token: string, body: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where:   { trackingToken: token },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status === 'CLOSED') throw new NotFoundException('Ticket is closed');

    const comment = await this.prisma.ticketComment.create({
      data: { ticketId: ticket.id, userId: ticket.createdById, body, type: CommentType.PUBLIC },
      include: { user: { select: { name: true } } },
    });

    // Notifica agentes via TicketHistory
    await this.prisma.ticketHistory.create({
      data: { ticketId: ticket.id, userId: ticket.createdById, action: 'COMMENTED', newValue: JSON.stringify({ commentId: comment.id, type: 'PUBLIC' }) },
    });

    return comment;
  }

  // Chamado pelo NotificationsService quando agente comenta — envia email ao cliente
  async notifyClientNewReply(opts: {
    ticketId:  string;
    agentName: string;
    preview:   string;
  }) {
    const ticket = await this.prisma.ticket.findUnique({
      where:  { id: opts.ticketId },
      select: { number: true, title: true, trackingToken: true, createdBy: { select: { name: true, email: true } } },
    });

    if (!ticket?.trackingToken) return; // ticket interno, sem tracking

    await this.mail.sendNewReply({
      to:            ticket.createdBy.email,
      name:          ticket.createdBy.name,
      ticketNumber:  ticket.number,
      ticketTitle:   ticket.title,
      agentName:     opts.agentName,
      preview:       opts.preview,
      trackingToken: ticket.trackingToken,
    });
  }

  async notifyClientStatusChanged(ticketId: string, newStatus: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where:  { id: ticketId },
      select: { number: true, title: true, trackingToken: true, project: { select: { name: true } }, createdBy: { select: { name: true, email: true } } },
    });

    if (!ticket?.trackingToken) return;

    await this.mail.sendTicketStatusChanged({
      to:            ticket.createdBy.email,
      name:          ticket.createdBy.name,
      ticketNumber:  ticket.number,
      ticketTitle:   ticket.title,
      projectName:   ticket.project.name,
      newStatus,
      trackingToken: ticket.trackingToken,
    }).catch(() => null);
  }
}
