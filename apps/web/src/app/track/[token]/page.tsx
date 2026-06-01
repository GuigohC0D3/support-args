'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Loader2, CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  OPEN:           { label: 'Aberto',               color: 'text-blue-600 bg-blue-50 border-blue-200',    icon: AlertTriangle },
  IN_PROGRESS:    { label: 'Em andamento',          color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Clock },
  WAITING_CLIENT: { label: 'Aguardando resposta',   color: 'text-violet-600 bg-violet-50 border-violet-200', icon: Clock },
  RESOLVED:       { label: 'Resolvido',             color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle },
  CLOSED:         { label: 'Encerrado',             color: 'text-zinc-500 bg-zinc-50 border-zinc-200',   icon: XCircle },
};

export default function TrackPage() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const [reply, setReply] = useState('');

  const { data: ticket, isLoading, isError } = useQuery({
    queryKey: ['track', token],
    queryFn:  () => axios.get(`${API}/integrations/track/${token}`).then((r) => r.data),
    retry: false,
  });

  const addComment = useMutation({
    mutationFn: () => axios.post(`${API}/integrations/track/${token}/comments`, { body: reply }),
    onSuccess: () => {
      setReply('');
      qc.invalidateQueries({ queryKey: ['track', token] });
    },
  });

  const status = ticket ? (STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.OPEN) : null;
  const StatusIcon = status?.icon;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 size={20} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-zinc-50 text-center px-4">
        <XCircle size={32} className="text-zinc-300" />
        <p className="font-bold text-zinc-700">Chamado não encontrado</p>
        <p className="text-sm text-zinc-400">O link pode ter expirado ou ser inválido.</p>
      </div>
    );
  }

  const isClosed = ticket.status === 'CLOSED';

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top bar */}
      <header className="bg-white border-b-2 border-zinc-200 px-4 py-3 flex items-center justify-between">
        <span className="font-black text-sm tracking-widest uppercase font-mono text-zinc-900">
          Support Hub
        </span>
        <span className="text-xs font-mono text-zinc-400">{ticket.project?.name}</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* Ticket header */}
        <div className="bg-white border-2 border-zinc-200 p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-black font-mono text-zinc-400 mb-1">#{ticket.number}</p>
              <h1 className="text-lg font-black text-zinc-900 leading-tight">{ticket.title}</h1>
            </div>
            {status && StatusIcon && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border text-xs font-bold uppercase tracking-wide ${status.color}`}>
                <StatusIcon size={12} />
                {status.label}
              </span>
            )}
          </div>

          <p className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed">
            {ticket.description}
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400 font-mono pt-3 border-t border-zinc-100">
            <span>Projeto: <strong className="text-zinc-600">{ticket.project?.name}</strong></span>
            {ticket.assignedTo && (
              <span>Responsável: <strong className="text-zinc-600">{ticket.assignedTo.name}</strong></span>
            )}
            <span>{format(new Date(ticket.createdAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
          </div>
        </div>

        {/* Timeline */}
        {ticket.comments?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-400 font-mono px-1">
              Conversa
            </p>
            {ticket.comments.map((c: any) => {
              const isClient = c.userId === ticket.createdById;
              return (
                <div
                  key={c.id}
                  className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] px-4 py-3 border-2 ${
                    isClient
                      ? 'bg-zinc-900 border-zinc-900 text-white'
                      : 'bg-white border-zinc-200 text-zinc-800'
                  }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[11px] font-bold uppercase tracking-wide ${isClient ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {isClient ? 'Você' : c.user?.name}
                      </span>
                      <span className={`text-[10px] font-mono ${isClient ? 'text-zinc-400' : 'text-zinc-400'}`}>
                        {format(new Date(c.createdAt), "d/MM HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{c.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Reply box */}
        {!isClosed ? (
          <div className="bg-white border-2 border-zinc-200 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-mono">
              Responder
            </p>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              placeholder="Escreva sua mensagem..."
              className="w-full px-3 py-2.5 border-2 border-zinc-200 text-sm font-sans bg-zinc-50 focus:outline-none focus:border-zinc-900 transition-colors resize-none"
            />
            <div className="flex justify-end">
              <button
                onClick={() => reply.trim() && addComment.mutate()}
                disabled={!reply.trim() || addComment.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-40 hover:bg-zinc-700 transition-colors"
              >
                {addComment.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Enviar
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-zinc-400 font-mono uppercase tracking-widest border-2 border-dashed border-zinc-200">
            Este chamado foi encerrado.
          </div>
        )}

        <p className="text-center text-[11px] text-zinc-300 font-mono">
          Salve este link para acompanhar seu chamado.
        </p>
      </main>
    </div>
  );
}
