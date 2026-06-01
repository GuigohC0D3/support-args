'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, FolderOpen, Ticket, Key, Copy, Eye, EyeOff, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
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

type Project = {
  id: string; name: string; description?: string;
  color: string; isActive: boolean; apiKey?: string;
  _count: { tickets: number };
};

type FormState = { name: string; description: string; color: string };

const PRESET_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

function ApiKeySection({ project, orgId, isAdmin }: { project: Project; orgId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [visible, setVisible]       = useState(false);
  const [showSnippet, setShowSnippet] = useState(false);

  const regenerate = useMutation({
    mutationFn: () => api.post(`/organizations/${orgId}/projects/${project.id}/regenerate-key`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', orgId] });
      toast.success('Chave regenerada — atualize nos projetos externos');
    },
    onError: () => toast.error('Erro ao regenerar chave'),
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const key = project.apiKey ?? '—';
  const masked = key !== '—' ? `sk_proj_${'•'.repeat(20)}` : '—';

  const snippet = `// Enviar ticket para ${project.name}
const response = await fetch('${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/integrations/tickets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    apiKey: '${key}',
    user: {
      email: currentUser.email, // e-mail do usuário logado no seu sistema
      name:  currentUser.name,
    },
    ticket: {
      title:       'Título do problema',
      description: 'Descreva o problema em detalhes',
      category:    'NOT_WORKING', // opcional: NOT_WORKING | QUESTION | PAYMENTS | ACCOUNT_ACCESS | SUGGESTION
    },
  }),
});

const { ticketId, ticketNumber } = await response.json();
console.log(\`Ticket #\${ticketNumber} criado: \${ticketId}\`);`;

  return (
    <div className="mt-4 pt-4 border-t-2 border-border space-y-3">
      <div className="flex items-center gap-2">
        <Key size={12} className="text-muted-foreground" />
        <span className="text-xs font-black uppercase tracking-widest font-mono text-muted-foreground">Integração</span>
      </div>

      {/* API Key row */}
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs font-mono bg-muted/50 px-2.5 py-1.5 border border-border overflow-hidden text-ellipsis whitespace-nowrap">
          {visible ? key : masked}
        </code>
        <button onClick={() => setVisible((v) => !v)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title={visible ? 'Ocultar' : 'Revelar'}>
          {visible ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button onClick={() => copy(key)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Copiar">
          <Copy size={13} />
        </button>
        {isAdmin && (
          <button onClick={() => regenerate.mutate()} disabled={regenerate.isPending}
            className="p-1.5 text-muted-foreground hover:text-amber-500 transition-colors" title="Regenerar chave">
            <RefreshCw size={13} className={regenerate.isPending ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {/* Code snippet toggle */}
      <button
        onClick={() => setShowSnippet((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono uppercase tracking-wide"
      >
        {showSnippet ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Ver código de integração
      </button>

      {showSnippet && (
        <div className="relative">
          <pre className="text-[11px] font-mono bg-muted/40 border border-border p-3 overflow-x-auto leading-relaxed">
            {snippet}
          </pre>
          <button
            onClick={() => copy(snippet)}
            className="absolute top-2 right-2 p-1.5 bg-background border border-border text-muted-foreground hover:text-foreground transition-colors"
            title="Copiar código"
          >
            <Copy size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  const qc = useQueryClient();
  const { activeOrgId, orgs, user } = useAuthStore();
  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const isAdmin = activeOrg?.role === 'ORG_ADMIN' || user?.isMasterAdmin;

  const [modal, setModal]         = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing]     = useState<Project | null>(null);
  const [form, setForm]           = useState<FormState>({ name: '', description: '', color: '#6366f1' });
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(null);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects', activeOrgId],
    queryFn:  () => api.get(`/organizations/${activeOrgId}/projects`).then((r) => r.data),
    enabled:  !!activeOrgId,
  });

  const save = useMutation({
    mutationFn: (data: FormState) =>
      modal === 'edit' && editing
        ? api.patch(`/organizations/${activeOrgId}/projects/${editing.id}`, data)
        : api.post(`/organizations/${activeOrgId}/projects`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', activeOrgId] });
      toast.success(modal === 'edit' ? 'Projeto atualizado' : 'Projeto criado');
      setModal(null);
    },
    onError: () => toast.error('Erro ao salvar projeto'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/organizations/${activeOrgId}/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', activeOrgId] });
      toast.success('Projeto removido');
      setDeleteId(null);
    },
    onError: () => toast.error('Erro ao remover projeto'),
  });

  function openCreate() {
    setForm({ name: '', description: '', color: '#6366f1' });
    setModal('create');
  }

  function openEdit(p: Project) {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? '', color: p.color });
    setModal('edit');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black uppercase tracking-widest font-mono">Projetos</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{projects.length} projeto(s)</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus size={13} /> Novo projeto
          </Button>
        )}
      </div>

      {isLoading && (
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Carregando...</p>
      )}

      {!isLoading && projects.length === 0 && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <FolderOpen size={32} className="opacity-30" />
            <p className="text-xs font-mono uppercase tracking-widest">Nenhum projeto ainda</p>
            {isAdmin && <Button size="sm" variant="outline" onClick={openCreate}>Criar primeiro projeto</Button>}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => (
          <Card key={p.id} className="group">
            <CardContent className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="font-bold text-sm">{p.name}</span>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(p)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => setDeleteId(p.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {p.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.description}</p>
              )}

              {/* Footer row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <Ticket size={11} />
                  <span>{p._count.tickets} ticket(s)</span>
                </div>
                <button
                  onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
                >
                  <Key size={11} />
                  {expanded === p.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
              </div>

              {/* Integration panel */}
              {expanded === p.id && (
                <ApiKeySection project={p} orgId={activeOrgId!} isAdmin={!!isAdmin} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={modal !== null} onOpenChange={(v) => !v && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal === 'edit' ? 'Editar projeto' : 'Novo projeto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do projeto" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm">Cancelar</Button></DialogClose>
            <Button size="sm" disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate(form)}>
              {save.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remover projeto</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Tem certeza? Os tickets associados não serão removidos.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm">Cancelar</Button></DialogClose>
            <Button variant="destructive" size="sm" disabled={remove.isPending}
              onClick={() => deleteId && remove.mutate(deleteId)}>
              {remove.isPending ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
