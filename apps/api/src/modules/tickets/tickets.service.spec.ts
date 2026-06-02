import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TicketStatus, TicketPriority, CommentType, HistoryAction } from '@support-hub/database';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IntegrationsService } from '../integrations/integrations.service';

const mockTicket = {
  id: 'ticket-1',
  number: 1,
  organizationId: 'org-1',
  projectId: 'project-1',
  title: 'Bug no login',
  description: 'Não consigo fazer login com email válido',
  status: TicketStatus.OPEN,
  priority: TicketPriority.HIGH,
  createdById: 'user-1',
  assignedToId: null,
  firstResponseAt: null,
  resolvedAt: null,
  closedAt: null,
  slaBreachedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  ticket: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  ticketHistory: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
  ticketComment: {
    create: jest.fn(),
  },
  userOrganization: {
    findUnique: jest.fn().mockResolvedValue({ role: 'SUPPORT_AGENT' }),
  },
};

describe('TicketsService', () => {
  let service: TicketsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: NotificationsService,
          useValue: {
            onTicketCreated: jest.fn().mockResolvedValue(undefined),
            onStatusChanged: jest.fn().mockResolvedValue(undefined),
            onTicketAssigned: jest.fn().mockResolvedValue(undefined),
            onNewComment: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: IntegrationsService,
          useValue: {
            notifyClientStatusChanged: jest.fn().mockResolvedValue(undefined),
            notifyClientNewReply: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('cria ticket com número sequencial por organização', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue({ number: 5 });
      mockPrisma.ticket.create.mockResolvedValue({ ...mockTicket, number: 6 });
      mockPrisma.ticketHistory.create.mockResolvedValue({});

      const result = await service.create(
        {
          organizationId: 'org-1',
          projectId: 'project-1',
          title: 'Novo bug',
          description: 'Descrição do bug encontrado',
          priority: TicketPriority.HIGH,
        },
        'org-1',
        'user-1',
      );

      expect(result.number).toBe(6);
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ number: 6, organizationId: 'org-1' }),
        }),
      );
      expect(mockPrisma.ticketHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: HistoryAction.CREATED }),
        }),
      );
    });

    it('começa no número 1 quando não há tickets na org', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue(null);
      mockPrisma.ticket.create.mockResolvedValue({ ...mockTicket, number: 1 });
      mockPrisma.ticketHistory.create.mockResolvedValue({});

      await service.create(
        {
          organizationId: 'org-1',
          projectId: 'project-1',
          title: 'Primeiro ticket',
          description: 'Descrição completa do primeiro ticket',
        },
        'org-1',
        'user-1',
      );

      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ number: 1 }),
        }),
      );
    });
  });

  describe('update', () => {
    it('registra histórico ao mudar status para RESOLVED', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(mockTicket);
      mockPrisma.ticket.update.mockResolvedValue({
        ...mockTicket,
        status: TicketStatus.RESOLVED,
        resolvedAt: new Date(),
      });
      mockPrisma.ticketHistory.createMany.mockResolvedValue({});

      await service.update('ticket-1', { status: TicketStatus.RESOLVED }, 'user-1');

      expect(mockPrisma.ticketHistory.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              action: HistoryAction.STATUS_CHANGED,
              oldValue: TicketStatus.OPEN,
              newValue: TicketStatus.RESOLVED,
            }),
          ]),
        }),
      );
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ resolvedAt: expect.any(Date) }),
        }),
      );
    });

    it('lança NotFoundException para ticket inexistente', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nao-existe', { status: TicketStatus.CLOSED }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('registra histórico ao atribuir ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(mockTicket);
      mockPrisma.ticket.update.mockResolvedValue({
        ...mockTicket,
        assignedToId: 'agent-1',
      });
      mockPrisma.ticketHistory.createMany.mockResolvedValue({});

      await service.update('ticket-1', { assignedToId: 'agent-1' }, 'user-1');

      expect(mockPrisma.ticketHistory.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ action: HistoryAction.ASSIGNED }),
          ]),
        }),
      );
    });
  });

  describe('addComment', () => {
    it('cria comentário e define firstResponseAt no primeiro comentário', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(mockTicket);
      mockPrisma.ticketComment.create.mockResolvedValue({
        id: 'comment-1',
        ticketId: 'ticket-1',
        userId: 'user-1',
        body: 'Estamos investigando',
        type: CommentType.PUBLIC,
        createdAt: new Date(),
        user: { id: 'user-1', name: 'Test User', email: 'test@test.com' },
      });
      mockPrisma.ticket.update.mockResolvedValue({});
      mockPrisma.ticketHistory.create.mockResolvedValue({});

      const result = await service.addComment(
        'ticket-1',
        { body: 'Estamos investigando' },
        'user-1',
      );

      expect(result.body).toBe('Estamos investigando');
      // firstResponseAt deve ser definido pois era null
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ firstResponseAt: expect.any(Date) }),
        }),
      );
    });

    it('não redefine firstResponseAt se já existe', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        ...mockTicket,
        firstResponseAt: new Date('2026-01-01'),
      });
      mockPrisma.ticketComment.create.mockResolvedValue({
        id: 'comment-2',
        body: 'Segunda resposta',
        type: CommentType.PUBLIC,
        createdAt: new Date(),
        user: { id: 'user-1', name: 'Test User', email: 'test@test.com' },
      });
      mockPrisma.ticketHistory.create.mockResolvedValue({});

      await service.addComment(
        'ticket-1',
        { body: 'Segunda resposta' },
        'user-1',
      );

      expect(mockPrisma.ticket.update).not.toHaveBeenCalled();
    });

    it('lança NotFoundException para ticket inexistente', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        service.addComment('nao-existe', { body: 'Resposta' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
