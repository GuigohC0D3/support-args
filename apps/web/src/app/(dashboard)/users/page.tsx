'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog';

type Member = {
  id: string; role: string; joinedAt: string;
  user: { id: string; name: string; email: string; avatarUrl?: string };
};

const ROLE_LABELS: Record<string, string> = {
  ORG_ADMIN:     'Admin',
  SUPPORT_AGENT: 'Agente',
  CLIENT:        'Cliente',
  MASTER_ADMIN:  'Master',
};

const ROLE_COLORS: Record<string, string> = {
  ORG_ADMIN:     'border-violet-500/50 text-violet-600 dark:text-violet-400 bg-violet-500/10',
  SUPPORT_AGENT: 'border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-500/10',
  CLIENT:        'border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
  MASTER_ADMIN:  'border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10',
};

const ROLES = [
  { value: 'CLIENT',        label: 'Cliente' },
  { value: 'SUPPORT_AGENT', label: 'Agente de Suporte' },
  { value: 'ORG_ADMIN',     label: 'Administrador' },
];

export default function UsersPage() {
  const qc = useQueryClient();
  const { activeOrgId, orgs, user } = useAuthStore();
  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const isAdmin = activeOrg?.role === 'ORG_ADMIN' || user?.isMasterAdmin;

  const [inviteOpen, setInviteOpen]   = useState(false);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [invite, setInvite]           = useState({ email: '', role: 'CLIENT' });
  const [roleEdit, setRoleEdit]       = useState<{ userId: string; role: string } | null>(null);

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ['org-members', activeOrgId],
    queryFn:  () => api.get(`/organizations/${activeOrgId}/users`).then((r) => r.data),
    enabled:  !!activeOrgId,
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.post(`/organizations/${activeOrgId}/users/invite`, invite),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-members', activeOrgId] });
      toast.success('Usuário convidado com sucesso');
      setInviteOpen(false);
      setInvite({ email: '', role: 'CLIENT' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(msg === 'User not found' ? 'Usuário não encontrado' : msg === 'User already in organization' ? 'Usuário já é membro' : 'Erro ao convidar usuário');
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/organizations/${activeOrgId}/users/${userId}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-members', activeOrgId] });
      toast.success('Papel atualizado');
      setRoleEdit(null);
    },
    onError: () => toast.error('Erro ao atualizar papel'),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => api.delete(`/organizations/${activeOrgId}/users/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-members', activeOrgId] });
      toast.success('Membro removido');
      setDeleteId(null);
    },
    onError: () => toast.error('Erro ao remover membro'),
  });

  const initials = (name: string) => name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black uppercase tracking-widest font-mono">Usuários</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{members.length} membro(s)</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-1.5">
            <UserPlus size={13} /> Convidar
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest p-6">Carregando...</p>
          ) : (
            <div className="divide-y-2 divide-border">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-4 px-5 py-4 group">
                  {/* Avatar */}
                  <div className="w-9 h-9 border-2 border-border flex items-center justify-center shrink-0 bg-muted/40">
                    <span className="text-xs font-black font-mono">{initials(m.user.name)}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{m.user.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{m.user.email}</p>
                  </div>

                  {/* Role badge */}
                  <span className={`text-[10px] font-black uppercase tracking-widest border px-2 py-0.5 font-mono ${ROLE_COLORS[m.role] ?? ''}`}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>

                  {/* Actions (admin only) */}
                  {isAdmin && m.user.id !== user?.id && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setRoleEdit({ userId: m.user.id, role: m.role })}
                        title="Alterar papel"
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ShieldCheck size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteId(m.user.id)}
                        title="Remover"
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                placeholder="usuario@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}
                className="w-full px-3 py-2 border-2 border-border rounded-none text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm">Cancelar</Button></DialogClose>
            <Button size="sm" disabled={!invite.email || inviteMutation.isPending}
              onClick={() => inviteMutation.mutate()}>
              {inviteMutation.isPending ? 'Convidando...' : 'Convidar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change role modal */}
      <Dialog open={!!roleEdit} onOpenChange={(v) => !v && setRoleEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar papel</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Novo papel</Label>
            <select value={roleEdit?.role ?? ''} onChange={(e) => setRoleEdit((r) => r ? { ...r, role: e.target.value } : r)}
              className="w-full px-3 py-2 border-2 border-border rounded-none text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm">Cancelar</Button></DialogClose>
            <Button size="sm" disabled={updateRole.isPending}
              onClick={() => roleEdit && updateRole.mutate(roleEdit)}>
              {updateRole.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remover membro</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Tem certeza que deseja remover este membro da organização?</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm">Cancelar</Button></DialogClose>
            <Button variant="destructive" size="sm" disabled={removeMember.isPending}
              onClick={() => deleteId && removeMember.mutate(deleteId)}>
              {removeMember.isPending ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
