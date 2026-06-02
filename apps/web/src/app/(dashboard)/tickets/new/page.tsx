'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useState, useRef, useCallback } from 'react';
import { AlertTriangle, HelpCircle, CreditCard, KeyRound, Lightbulb, Paperclip, X, FileVideo, ImageIcon } from 'lucide-react';
import api from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CATEGORIES = [
  { value: 'NOT_WORKING',    label: 'Não funciona',  icon: AlertTriangle },
  { value: 'QUESTION',       label: 'Dúvida',         icon: HelpCircle },
  { value: 'PAYMENTS',       label: 'Pagamentos',     icon: CreditCard },
  { value: 'ACCOUNT_ACCESS', label: 'Conta/Acesso',   icon: KeyRound },
  { value: 'SUGGESTION',     label: 'Sugestão',       icon: Lightbulb },
] as const;

type ImpactData = {
  blocked?: 'yes' | 'partial' | 'no';
  frequency?: 'first_time' | 'sometimes' | 'always';
  scope?: 'just_me' | 'my_team' | 'everyone';
  financial?: 'yes' | 'no';
  urgency?: 'can_wait' | 'need_today' | 'everything_stopped';
};

const IMPACT_QUESTIONS: {
  key: keyof ImpactData;
  label: string;
  options: { value: string; label: string }[];
}[] = [
  {
    key: 'blocked',
    label: 'Consegue continuar usando?',
    options: [
      { value: 'yes',     label: 'Sim, consigo' },
      { value: 'partial', label: 'Parcialmente' },
      { value: 'no',      label: 'Não, travei' },
    ],
  },
  {
    key: 'frequency',
    label: 'Com que frequência acontece?',
    options: [
      { value: 'first_time', label: '1ª vez' },
      { value: 'sometimes',  label: 'Às vezes' },
      { value: 'always',     label: 'Sempre' },
    ],
  },
  {
    key: 'scope',
    label: 'Quantas pessoas são afetadas?',
    options: [
      { value: 'just_me',  label: 'Só eu' },
      { value: 'my_team',  label: 'Minha equipe' },
      { value: 'everyone', label: 'Toda a empresa' },
    ],
  },
  {
    key: 'financial',
    label: 'Afeta pagamentos ou clientes?',
    options: [
      { value: 'yes', label: 'Sim' },
      { value: 'no',  label: 'Não' },
    ],
  },
  {
    key: 'urgency',
    label: 'Qual a urgência pra você?',
    options: [
      { value: 'can_wait',          label: 'Pode esperar' },
      { value: 'need_today',        label: 'Preciso hoje' },
      { value: 'everything_stopped', label: 'Parou tudo' },
    ],
  },
];

const schema = z.object({
  title: z.string().min(5, 'Mínimo 5 caracteres'),
  description: z.string().min(10, 'Mínimo 10 caracteres'),
  projectId: z.string().min(1, 'Selecione um projeto'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: z.enum(['NOT_WORKING', 'QUESTION', 'PAYMENTS', 'ACCOUNT_ACCESS', 'SUGGESTION']).optional(),
});

type FormData = z.infer<typeof schema>;

function ImpactToggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(value === opt.value ? undefined : opt.value)}
          className={`px-3 py-1.5 text-xs font-bold border-2 transition-colors
            ${value === opt.value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-foreground hover:border-primary/60'
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function NewTicketPage() {
  const router = useRouter();
  const { activeOrgId, orgs } = useAuthStore();
  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const isClient = activeOrg?.role === 'CLIENT';

  const [impact, setImpact] = useState<ImpactData>({});
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setImpactField = (key: keyof ImpactData, val: string | undefined) => {
    setImpact((prev) => ({ ...prev, [key]: val }));
  };

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const valid = Array.from(incoming).filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...valid.filter((f) => !existing.has(f.name + f.size))];
    });
  }, []);

  const { data: projects } = useQuery({
    queryKey: ['projects', activeOrgId],
    queryFn: () => api.get(`/organizations/${activeOrgId}/projects`).then((r) => r.data),
    enabled: !!activeOrgId,
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'MEDIUM' },
  });

  const selectedCategory = watch('category');

  const create = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await api.post('/tickets', {
        ...data,
        priority: isClient ? 'MEDIUM' : (data.priority ?? 'MEDIUM'),
        organizationId: activeOrgId,
        impactData: Object.keys(impact).length > 0 ? impact : undefined,
      });
      if (files.length > 0) {
        const form = new window.FormData();
        files.forEach((f) => form.append('files', f));
        await api.post(`/tickets/${res.data.id}/attachments`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }).catch(() => {
          toast.warning('Ticket criado, mas falha ao enviar os anexos. Tente novamente no detalhe do chamado.');
        });
      }
      return res;
    },
    onSuccess: (res) => {
      toast.success('Ticket criado com sucesso');
      router.push(`/tickets/${res.data.id}`);
    },
    onError: () => toast.error('Erro ao criar ticket'),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Novo Ticket</h1>

      {/* Detalhes */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes do chamado</CardTitle>
        </CardHeader>
        <CardContent>
          <form id="ticket-form" onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" {...register('title')} placeholder="Descreva o problema resumidamente" />
              {errors.title && <p className="text-destructive text-xs">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição *</Label>
              <Textarea
                id="description"
                {...register('description')}
                rows={5}
                placeholder="Descreva o problema em detalhes..."
              />
              {errors.description && <p className="text-destructive text-xs">{errors.description.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>
                Sobre o que é?{' '}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setValue('category', selectedCategory === value ? undefined : (value as FormData['category']))
                    }
                    className={`flex items-center gap-2 px-3 py-2.5 border-2 text-sm font-semibold transition-colors text-left
                      ${selectedCategory === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-foreground hover:border-primary/50'
                      }`}
                  >
                    <Icon size={14} className="shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className={`grid gap-4 ${isClient ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <div className="space-y-1.5">
                <Label htmlFor="projectId">Projeto *</Label>
                <select
                  id="projectId"
                  {...register('projectId')}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecione...</option>
                  {projects?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {errors.projectId && <p className="text-destructive text-xs">{errors.projectId.message}</p>}
              </div>

              {!isClient && (
                <div className="space-y-1.5">
                  <Label htmlFor="priority">Prioridade</Label>
                  <select
                    id="priority"
                    {...register('priority')}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                    <option value="URGENT">Urgente</option>
                  </select>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Triagem de impacto */}
      <Card>
        <CardHeader>
          <CardTitle>
            Nos ajude a entender o impacto{' '}
            <span className="text-muted-foreground font-normal text-sm">(opcional)</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Essas informações ajudam a equipe a priorizar e resolver mais rápido.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {IMPACT_QUESTIONS.map((q) => (
            <div key={q.key} className="space-y-2">
              <p className="text-sm font-semibold">{q.label}</p>
              <ImpactToggle
                options={q.options}
                value={impact[q.key]}
                onChange={(v) => setImpactField(q.key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Anexos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip size={15} />
            Anexos
            <span className="text-muted-foreground font-normal text-sm">(opcional)</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">Imagens ou vídeos que ajudem a identificar o problema.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-none p-6 text-center cursor-pointer transition-colors
              ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <Paperclip size={20} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Clique ou arraste arquivos aqui
            </p>
            <p className="text-xs text-muted-foreground mt-1">Imagens e vídeos · máx 50MB por arquivo</p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 border-2 border-border bg-muted/20">
                  {f.type.startsWith('video/') ? (
                    <FileVideo size={14} className="text-muted-foreground shrink-0" />
                  ) : (
                    <ImageIcon size={14} className="text-muted-foreground shrink-0" />
                  )}
                  <span className="text-xs font-mono flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    {(f.size / 1024 / 1024).toFixed(1)}MB
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((_, j) => j !== i)); }}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-6">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" form="ticket-form" disabled={create.isPending}>
          {create.isPending ? 'Criando...' : 'Criar Ticket'}
        </Button>
      </div>
    </div>
  );
}
