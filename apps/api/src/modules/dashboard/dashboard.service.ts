import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketStatus } from '@support-hub/database';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getMetrics(orgId: string) {
    const [total, byStatus, byPriority, avgResponseRaw] = await Promise.all([
      this.prisma.ticket.count({ where: { organizationId: orgId } }),
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: { organizationId: orgId },
        _count: true,
      }),
      this.prisma.ticket.groupBy({
        by: ['priority'],
        where: { organizationId: orgId },
        _count: true,
      }),
      this.prisma.$queryRaw<{ avg_hours: number }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("firstResponseAt" - "createdAt")) / 3600) as avg_hours
        FROM tickets
        WHERE "organizationId" = ${orgId}
          AND "firstResponseAt" IS NOT NULL
      `,
    ]);

    const statusMap = byStatus.reduce(
      (acc, s) => ({ ...acc, [s.status]: s._count }),
      {} as Record<string, number>,
    );

    return {
      total,
      open: statusMap[TicketStatus.OPEN] ?? 0,
      inProgress: statusMap[TicketStatus.IN_PROGRESS] ?? 0,
      waitingClient: statusMap[TicketStatus.WAITING_CLIENT] ?? 0,
      resolved: statusMap[TicketStatus.RESOLVED] ?? 0,
      closed: statusMap[TicketStatus.CLOSED] ?? 0,
      byPriority: byPriority.reduce(
        (acc, p) => ({ ...acc, [p.priority]: p._count }),
        {} as Record<string, number>,
      ),
      avgFirstResponseHours: Number(avgResponseRaw[0]?.avg_hours ?? 0).toFixed(1),
    };
  }

  async getByProject(orgId: string) {
    return this.prisma.ticket.groupBy({
      by: ['projectId'],
      where: { organizationId: orgId },
      _count: true,
      orderBy: { _count: { projectId: 'desc' } },
    });
  }

  async getSLACompliance(orgId: string) {
    const [total, breached, atRisk] = await Promise.all([
      this.prisma.ticket.count({
        where: { organizationId: orgId, status: { notIn: [TicketStatus.CLOSED] } },
      }),
      this.prisma.ticket.count({
        where: {
          organizationId: orgId,
          slaBreachedAt: { not: null, lt: new Date() },
          status: { notIn: [TicketStatus.CLOSED, TicketStatus.RESOLVED] },
        },
      }),
      this.prisma.ticket.count({
        where: {
          organizationId: orgId,
          slaBreachedAt: {
            not: null,
            gte: new Date(),
            lte: new Date(Date.now() + 2 * 60 * 60 * 1000), // próximas 2h
          },
          status: { notIn: [TicketStatus.CLOSED, TicketStatus.RESOLVED] },
        },
      }),
    ]);

    const compliant = total - breached;
    const complianceRate = total > 0 ? ((compliant / total) * 100).toFixed(1) : '100.0';

    return { total, compliant, breached, atRisk, complianceRate };
  }
}
