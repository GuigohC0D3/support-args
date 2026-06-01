'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api-client';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  ticket?: { id: string; number: number; title: string } | null;
};

const TYPE_ICON: Record<string, string> = {
  TICKET_CREATED:       '🎫',
  TICKET_ASSIGNED:      '👤',
  TICKET_STATUS_CHANGED:'🔄',
  NEW_COMMENT:          '💬',
  TICKET_RESOLVED:      '✅',
  TICKET_CLOSED:        '🔒',
};

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn:  () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const unread = notifications.filter((n) => !n.read).length;

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleClick(n: Notification) {
    if (!n.read) markRead.mutate(n.id);
    if (n.ticket?.id) {
      router.push(`/tickets/${n.ticket.id}`);
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Notificações"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-black font-mono rounded-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 w-80 z-50 border-2 border-border bg-card shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b-2 border-border">
            <span className="text-xs font-black uppercase tracking-widest font-mono">
              Notificações {unread > 0 && <span className="text-primary">({unread})</span>}
            </span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  title="Marcar todas como lidas"
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CheckCheck size={13} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground font-mono uppercase tracking-widest">
                Nenhuma notificação
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'group flex items-start gap-3 px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-muted/40 transition-colors',
                    !n.read && 'bg-primary/5',
                  )}
                  onClick={() => handleClick(n)}
                >
                  {/* Icon */}
                  <span className="text-base shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? '🔔'}</span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-semibold leading-tight', !n.read && 'font-bold')}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-1">
                      {format(new Date(n.createdAt), "d MMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {!n.read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id); }}
                        title="Marcar como lida"
                        className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Check size={11} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); remove.mutate(n.id); }}
                      title="Remover"
                      className="p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
