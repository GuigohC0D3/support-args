'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Lock, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const IMPACT_LABELS: Record<string, Record<string, string>> = {
  blocked:   { yes: 'Consegue usar', partial: 'Parcialmente', no: 'Travado' },
  frequency: { first_time: '1ª vez', sometimes: 'Às vezes', always: 'Sempre' },
  scope:     { just_me: 'Só o usuário', my_team: 'A equipe', everyone: 'Toda a empresa' },
  financial: { yes: 'Afeta pagamentos/clientes', no: 'Sem impacto financeiro' },
  urgency:   { can_wait: 'Pode esperar', need_today: 'Precisa hoje', everything_stopped: 'Parou tudo' },
};

const IMPACT_ICONS: Record<string, string> = {
  blocked: '🚧', frequency: '🔁', scope: '👥', financial: '💰', urgency: '⚡',
};
import api from '@/lib/api-client';
import { TicketStatusBadge } from '@/components/tickets/ticket-status-badge';
import { TicketPriorityBadge } from '@/components/tickets/ticket-priority-badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const selectClass =
  'text-xs font-bold uppercase tracking-wide border-2 border-input px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors font-mono';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.get(`/tickets/${id}`).then(r => r.data),
  });

  const addComment = useMutation({
    mutationFn: (body: string) =>
      api.post(`/tickets/${id}/comments`, { body, type: isInternal ? 'INTERNAL' : 'PUBLIC' }),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      toast.success('Comentário adicionado');
    },
    onError: () => toast.error('Erro ao adicionar comentário'),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/tickets/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      toast.success('Status atualizado');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-xs font-mono uppercase tracking-widest">Carregando...</span>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-muted-foreground py-16 text-center text-xs font-mono uppercase tracking-widest">
        Ticket não encontrado
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} />
        Tickets
      </Link>
      {/* Header card */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-muted-foreground font-mono mb-2">
                #{ticket.number}
              </p>
              <h1 className="text-lg font-black leading-tight">{ticket.title}</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <TicketPriorityBadge priority={ticket.priority} />
              <select
                value={ticket.status}
                onChange={(e) => updateStatus.mutate((e.target as HTMLSelectElement).value)}
                className={selectClass}
              >
                <option value="OPEN">Aberto</option>
                <option value="IN_PROGRESS">Em andamento</option>
                <option value="WAITING_CLIENT">Aguardando cliente</option>
                <option value="RESOLVED">Resolvido</option>
                <option value="CLOSED">Fechado</option>
              </select>
            </div>
          </div>

          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {ticket.description}
          </p>

          {ticket.impactData && Object.keys(ticket.impactData).length > 0 && (
            <div className="pt-4 border-t-2 border-border space-y-2">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground font-mono">
                Impacto relatado
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ticket.impactData as Record<string, string>).map(([key, val]) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 border-2 border-border text-xs font-semibold bg-muted/40"
                  >
                    <span>{IMPACT_ICONS[key]}</span>
                    {IMPACT_LABELS[key]?.[val] ?? val}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground pt-4 border-t-2 border-border items-center font-mono">
            <span>
              Por <strong className="text-foreground">{ticket.createdBy?.name}</strong>
            </span>
            <span>
              Projeto: <strong className="text-foreground">{ticket.project?.name}</strong>
            </span>
            {ticket.assignedTo && (
              <span>
                Agente: <strong className="text-foreground">{ticket.assignedTo.name}</strong>
              </span>
            )}
            <span>{format(new Date(ticket.createdAt), "d/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
            <TicketStatusBadge status={ticket.status} />
          </div>
        </CardContent>
      </Card>

      {/* Comments */}
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground font-mono px-1">
          Comentários — {ticket.comments?.length ?? 0}
        </p>

        {ticket.comments?.length === 0 && (
          <p className="text-xs text-muted-foreground font-mono px-1">Nenhum comentário ainda.</p>
        )}

        {ticket.comments?.map((c: any) => (
          <Card
            key={c.id}
            className={cn(
              c.type === 'INTERNAL' ? 'border-amber-500/60' : '',
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="font-bold text-sm">{c.user?.name}</span>
                {c.type === 'INTERNAL' && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-bold uppercase tracking-wide">
                    <Lock size={9} /> Interno
                  </span>
                )}
                <span className="text-xs text-muted-foreground font-mono ml-auto">
                  {format(new Date(c.createdAt), "d/MM 'às' HH:mm")}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{c.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New comment */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Textarea
            value={comment}
            onChange={(e) => setComment((e.target as HTMLTextAreaElement).value)}
            placeholder="Escreva um comentário..."
            rows={4}
            className="resize-none font-mono text-sm"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal((e.target as HTMLInputElement).checked)}
                className="accent-primary"
              />
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-wide font-semibold">
                Interno
              </span>
            </label>
            <Button
              onClick={() => comment.trim() && addComment.mutate(comment)}
              disabled={!comment.trim() || addComment.isPending}
              size="sm"
            >
              {addComment.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
              Enviar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
