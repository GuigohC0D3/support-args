import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType, UserRole } from '@support-hub/database';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // ─── Leitura ────────────────────────────────────────────────────────────────

  async findByUser(userId: string) {
    return this.prisma.notification.findMany({
      where:   { userId },
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
      take:    50,
      include: {
        ticket: { select: { id: true, number: true, title: true } },
      },
    });
  }

  async countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data:  { read: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data:  { read: true },
    });
  }

  async remove(id: string, userId: string) {
    return this.prisma.notification.deleteMany({ where: { id, userId } });
  }

  // ─── Criação interna ────────────────────────────────────────────────────────

  private async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    ticketId?: string,
  ) {
    return this.prisma.notification.create({
      data: { userId, type, title, body, ticketId },
    });
  }

  private async createMany(
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    ticketId?: string,
  ) {
    if (userIds.length === 0) return;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, type, title, body, ticketId })),
    });
  }

  // ─── Helpers para buscar quem notificar ─────────────────────────────────────

  private async getAgentsAndAdmins(organizationId: string): Promise<string[]> {
    const members = await this.prisma.userOrganization.findMany({
      where: {
        organizationId,
        role: { in: [UserRole.SUPPORT_AGENT, UserRole.ORG_ADMIN] },
      },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  private async getUserRole(userId: string, organizationId: string): Promise<UserRole | null> {
    const membership = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { role: true },
    });
    return membership?.role ?? null;
  }

  // ─── Triggers de eventos ────────────────────────────────────────────────────

  async onTicketCreated(ticket: { id: string; number: number; title: string; organizationId: string; createdById: string }) {
    const agentsAndAdmins = await this.getAgentsAndAdmins(ticket.organizationId);
    const targets = agentsAndAdmins.filter((id) => id !== ticket.createdById);

    await this.createMany(
      targets,
      NotificationType.TICKET_CREATED,
      'Novo chamado aberto',
      `#${ticket.number} — ${ticket.title}`,
      ticket.id,
    );
  }

  async onTicketAssigned(ticket: { id: string; number: number; title: string }, assignedToId: string, assignedById: string) {
    if (assignedToId === assignedById) return;
    await this.create(
      assignedToId,
      NotificationType.TICKET_ASSIGNED,
      'Chamado atribuído a você',
      `#${ticket.number} — ${ticket.title}`,
      ticket.id,
    );
  }

  async onStatusChanged(
    ticket: { id: string; number: number; title: string; createdById: string; organizationId: string },
    newStatus: string,
    changedById: string,
  ) {
    const STATUS_LABELS: Record<string, string> = {
      IN_PROGRESS:    'Em andamento',
      WAITING_CLIENT: 'Aguardando sua resposta',
      RESOLVED:       'Resolvido',
      CLOSED:         'Encerrado',
    };

    const label = STATUS_LABELS[newStatus];
    if (!label) return;

    // Notifica o cliente criador do ticket
    if (ticket.createdById !== changedById) {
      await this.create(
        ticket.createdById,
        newStatus === 'RESOLVED' ? NotificationType.TICKET_RESOLVED
          : newStatus === 'CLOSED' ? NotificationType.TICKET_CLOSED
          : NotificationType.TICKET_STATUS_CHANGED,
        `Chamado ${label.toLowerCase()}`,
        `#${ticket.number} — ${ticket.title}`,
        ticket.id,
      );
    }

    // Se resolvido/fechado, notifica os agentes também (exceto quem mudou)
    if (newStatus === 'RESOLVED' || newStatus === 'CLOSED') {
      const agents = await this.getAgentsAndAdmins(ticket.organizationId);
      const targets = agents.filter((id) => id !== changedById);
      await this.createMany(
        targets,
        newStatus === 'RESOLVED' ? NotificationType.TICKET_RESOLVED : NotificationType.TICKET_CLOSED,
        `Chamado #${ticket.number} ${label.toLowerCase()}`,
        ticket.title,
        ticket.id,
      );
    }
  }

  async onNewComment(
    ticket: { id: string; number: number; title: string; createdById: string; assignedToId: string | null; organizationId: string },
    commenterId: string,
    isInternal: boolean,
  ) {
    const commenterRole = await this.getUserRole(commenterId, ticket.organizationId);
    const isAgent = commenterRole === UserRole.SUPPORT_AGENT || commenterRole === UserRole.ORG_ADMIN;

    if (isInternal) {
      // Comentário interno — apenas agentes/admins (exceto quem comentou)
      const agents = await this.getAgentsAndAdmins(ticket.organizationId);
      const targets = agents.filter((id) => id !== commenterId);
      await this.createMany(
        targets,
        NotificationType.NEW_COMMENT,
        'Novo comentário interno',
        `#${ticket.number} — ${ticket.title}`,
        ticket.id,
      );
      return;
    }

    if (isAgent) {
      // Agente respondeu — notifica o cliente criador
      if (ticket.createdById !== commenterId) {
        await this.create(
          ticket.createdById,
          NotificationType.NEW_COMMENT,
          'Nova resposta no seu chamado',
          `#${ticket.number} — ${ticket.title}`,
          ticket.id,
        );
      }
    } else {
      // Cliente respondeu — notifica agente responsável ou todos os agentes
      const targets = ticket.assignedToId
        ? [ticket.assignedToId]
        : await this.getAgentsAndAdmins(ticket.organizationId);

      await this.createMany(
        targets.filter((id) => id !== commenterId),
        NotificationType.NEW_COMMENT,
        'Cliente respondeu no chamado',
        `#${ticket.number} — ${ticket.title}`,
        ticket.id,
      );
    }
  }
}
