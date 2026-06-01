'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { TicketStatusBadge } from '@/components/tickets/ticket-status-badge';
import { TicketPriorityBadge } from '@/components/tickets/ticket-priority-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

const selectClass =
  'px-3 py-1.5 border-2 border-input bg-background text-foreground text-xs font-semibold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-ring transition-colors';

export default function TicketsPage() {
  const router = useRouter();
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (activeOrgId) params.set('organizationId', activeOrgId);
  if (search)      params.set('search', search);
  if (status)      params.set('status', status);
  if (priority)    params.set('priority', priority);

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', activeOrgId, search, status, priority, page],
    queryFn: () => api.get(`/tickets?${params}`).then(r => r.data),
    enabled: !!activeOrgId,
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="border-b-2 border-border pb-4 flex items-end justify-between">
        <div>
          <h1 className="text-xs font-black uppercase tracking-widest font-mono text-muted-foreground">
            Tickets
          </h1>
          {data?.total != null && (
            <p className="text-2xl font-black font-mono mt-1">{data.total} <span className="text-sm text-muted-foreground font-normal">chamados</span></p>
          )}
        </div>
        <Button size="sm" onClick={() => router.push('/tickets/new')}>
          <Plus size={13} />
          Novo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch((e.target as HTMLInputElement).value); setPage(1); }}
            placeholder="Buscar..."
            className="pl-9 h-9 font-mono text-xs"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus((e.target as HTMLSelectElement).value); setPage(1); }}
          className={selectClass}
        >
          <option value="">Todos os status</option>
          <option value="OPEN">Aberto</option>
          <option value="IN_PROGRESS">Em andamento</option>
          <option value="WAITING_CLIENT">Aguardando cliente</option>
          <option value="RESOLVED">Resolvido</option>
          <option value="CLOSED">Fechado</option>
        </select>
        <select
          value={priority}
          onChange={(e) => { setPriority((e.target as HTMLSelectElement).value); setPage(1); }}
          className={selectClass}
        >
          <option value="">Todas as prioridades</option>
          <option value="LOW">Baixa</option>
          <option value="MEDIUM">Média</option>
          <option value="HIGH">Alta</option>
          <option value="URGENT">Urgente</option>
        </select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden animate-slide-up">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-border bg-muted/40">
              <th className="text-left px-4 py-3 font-black text-muted-foreground w-16 text-xs uppercase tracking-widest font-mono">#</th>
              <th className="text-left px-4 py-3 font-black text-muted-foreground text-xs uppercase tracking-widest font-mono">Título</th>
              <th className="text-left px-4 py-3 font-black text-muted-foreground w-36 text-xs uppercase tracking-widest font-mono">Status</th>
              <th className="text-left px-4 py-3 font-black text-muted-foreground w-28 text-xs uppercase tracking-widest font-mono">Prioridade</th>
              <th className="text-left px-4 py-3 font-black text-muted-foreground w-36 text-xs uppercase tracking-widest font-mono hidden md:table-cell">Projeto</th>
              <th className="text-left px-4 py-3 font-black text-muted-foreground w-36 text-xs uppercase tracking-widest font-mono hidden md:table-cell">Criado</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-border">
            {isLoading && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground text-xs font-mono uppercase tracking-widest">
                  Carregando...
                </td>
              </tr>
            )}
            {!isLoading && !data?.data?.length && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground text-xs font-mono uppercase tracking-widest">
                  Nenhum ticket encontrado
                </td>
              </tr>
            )}
            {data?.data?.map((ticket: any) => (
              <tr
                key={ticket.id}
                className="hover:bg-muted/30 transition-colors duration-100"
              >
                <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs font-bold">
                  #{ticket.number}
                </td>
                <td className="px-4 py-3.5">
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="font-semibold hover:text-primary transition-colors"
                  >
                    {ticket.title}
                  </Link>
                  {ticket.assignedTo && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{ticket.assignedTo.name}</p>
                  )}
                </td>
                <td className="px-4 py-3.5"><TicketStatusBadge status={ticket.status} /></td>
                <td className="px-4 py-3.5"><TicketPriorityBadge priority={ticket.priority} /></td>
                <td className="px-4 py-3.5 text-muted-foreground text-xs font-mono hidden md:table-cell">
                  {ticket.project?.name}
                </td>
                <td className="px-4 py-3.5 text-muted-foreground text-xs font-mono hidden md:table-cell">
                  {format(new Date(ticket.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span>{data.total} tickets</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
              ← Anterior
            </Button>
            <span className="px-3 tabular-nums">{page} / {data.totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === data.totalPages}>
              Próximo →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
