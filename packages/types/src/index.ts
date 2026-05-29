export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CLIENT' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type UserRole = 'MASTER_ADMIN' | 'ORG_ADMIN' | 'SUPPORT_AGENT' | 'CLIENT';
export type CommentType = 'PUBLIC' | 'INTERNAL';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Ticket {
  id: string;
  number: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  organizationId: string;
  projectId: string;
  createdById: string;
  assignedToId?: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardMetrics {
  total: number;
  open: number;
  inProgress: number;
  waitingClient: number;
  resolved: number;
  closed: number;
  byPriority: Record<TicketPriority, number>;
  avgFirstResponseHours: string;
}

export interface SLACompliance {
  total: number;
  compliant: number;
  breached: number;
  atRisk: number;
  complianceRate: string;
}
