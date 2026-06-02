'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Lock, Loader2, ArrowLeft, FileVideo, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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
import { useAuthStore } from '@/store/auth-store';
import { TicketStatusBadge } from '@/components/tickets/ticket-status-badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const selectClass =
  'text-xs font-bold uppercase tracking-wide border-2 border-input px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors font-mono';

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(5, Math.max(1, s - e.deltaY * 0.001)));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale === 1) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX - lastOffset.current.x, y: e.clientY - lastOffset.current.y };
  }, [scale]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const next = { x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y };
    lastOffset.current = next;
    setOffset(next);
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); lastOffset.current = { x: 0, y: 0 }; };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button onClick={() => setScale((s) => Math.min(5, s + 0.5))} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors">
          <ZoomIn size={15} />
        </button>
        <button onClick={() => setScale((s) => Math.max(1, s - 0.5))} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors">
          <ZoomOut size={15} />
        </button>
        <button onClick={reset} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors">
          <RotateCcw size={15} />
        </button>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors">
          <X size={15} />
        </button>
      </div>

      <div
        className="overflow-hidden max-w-[90vw] max-h-[90vh]"
        style={{ cursor: scale > 1 ? 'grab' : 'default' }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-[90vw] max-h-[90vh] object-contain select-none transition-transform duration-100"
          style={{ transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)` }}
        />
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs font-mono">
        {Math.round(scale * 100)}% · scroll ou botões para zoom · ESC para fechar
      </div>
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

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
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Status atualizado');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const updatePriority = useMutation({
    mutationFn: (priority: string) => api.patch(`/tickets/${id}`, { priority }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Prioridade atualizada');
    },
    onError: () => toast.error('Erro ao atualizar prioridade'),
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
    <>
    {lightbox && (
      <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
    )}
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
              <select
                value={ticket.priority}
                onChange={(e) => updatePriority.mutate((e.target as HTMLSelectElement).value)}
                className={selectClass}
              >
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </select>
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

          {ticket.assignedTo && (
            <div className="flex items-center gap-2.5 pt-3 border-t-2 border-border">
              <div className="w-7 h-7 rounded-full border-2 border-primary shrink-0 overflow-hidden bg-primary/10 flex items-center justify-center">
                {ticket.assignedTo.avatarUrl ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_API_URL}${ticket.assignedTo.avatarUrl}`}
                    alt={ticket.assignedTo.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] font-black text-primary">
                    {ticket.assignedTo.name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Responsável</span>
                <span className="text-xs font-bold text-foreground">{ticket.assignedTo.name}</span>
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
            <span>{format(new Date(ticket.createdAt), "d/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
            <TicketStatusBadge status={ticket.status} />
          </div>
        </CardContent>
      </Card>

      {/* Attachments */}
      {ticket.attachments?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground font-mono px-1">
            Anexos — {ticket.attachments.length}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ticket.attachments.map((a: any) => {
              const url = `${process.env.NEXT_PUBLIC_API_URL}${a.storageKey}`;
              const isImage = a.mimeType.startsWith('image/');
              return (
                <div
                  key={a.id}
                  className="border-2 border-border hover:border-primary transition-colors overflow-hidden group cursor-pointer"
                  onClick={() => isImage
                    ? setLightbox({ src: url, alt: a.fileName })
                    : window.open(url, '_blank')
                  }
                >
                  {isImage ? (
                    <img
                      src={url}
                      alt={a.fileName}
                      className="w-full h-28 object-cover group-hover:opacity-90 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-28 bg-muted flex flex-col items-center justify-center gap-1.5">
                      <FileVideo size={24} className="text-muted-foreground" />
                      <span className="text-xs font-mono text-muted-foreground truncate px-2 max-w-full">{a.fileName}</span>
                    </div>
                  )}
                  <div className="px-2 py-1.5 border-t-2 border-border bg-muted/30">
                    <p className="text-[10px] font-mono text-muted-foreground truncate">{a.fileName}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{(a.fileSize / 1024 / 1024).toFixed(1)}MB</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground font-mono px-1">
          Comentários — {ticket.comments?.length ?? 0}
        </p>

        {ticket.comments?.length === 0 && (
          <p className="text-xs text-muted-foreground font-mono px-1">Nenhum comentário ainda.</p>
        )}

        {ticket.comments?.map((c: any) => {
          const isMine = c.user?.id === currentUser?.id;
          const avatar = (
            <div className="w-7 h-7 rounded-full border-2 border-border shrink-0 overflow-hidden bg-muted flex items-center justify-center">
              {c.user?.avatarUrl ? (
                <img
                  src={`${process.env.NEXT_PUBLIC_API_URL}${c.user.avatarUrl}`}
                  alt={c.user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[10px] font-black text-muted-foreground">
                  {c.user?.name?.charAt(0).toUpperCase() ?? '?'}
                </span>
              )}
            </div>
          );

          return (
            <div key={c.id} className={cn('flex items-end gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}>
              {avatar}
              <div className={cn('max-w-[75%] space-y-1', isMine ? 'items-end' : 'items-start', 'flex flex-col')}>
                <div className={cn('flex items-center gap-1.5', isMine ? 'flex-row-reverse' : 'flex-row')}>
                  <span className="text-xs font-bold text-muted-foreground">{isMine ? 'Você' : c.user?.name}</span>
                  {c.type === 'INTERNAL' && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-bold uppercase tracking-wide">
                      <Lock size={9} /> Interno
                    </span>
                  )}
                </div>
                <div className={cn(
                  'px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed',
                  isMine
                    ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
                    : c.type === 'INTERNAL'
                      ? 'bg-amber-500/10 border border-amber-500/40 text-foreground rounded-2xl rounded-bl-sm'
                      : 'bg-muted text-foreground rounded-2xl rounded-bl-sm',
                )}>
                  {c.body}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono px-1">
                  {format(new Date(c.createdAt), "d/MM 'às' HH:mm")}
                </span>
              </div>
            </div>
          );
        })}
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
    </>
  );
}
