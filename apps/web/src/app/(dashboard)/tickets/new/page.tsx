'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import api from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  title: z.string().min(5, 'Mínimo 5 caracteres'),
  description: z.string().min(10, 'Mínimo 10 caracteres'),
  projectId: z.string().min(1, 'Selecione um projeto'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
});

type FormData = z.infer<typeof schema>;

export default function NewTicketPage() {
  const router = useRouter();
  const activeOrgId = useAuthStore((s) => s.activeOrgId);

  const { data: projects } = useQuery({
    queryKey: ['projects', activeOrgId],
    queryFn: () => api.get(`/organizations/${activeOrgId}/projects`).then(r => r.data),
    enabled: !!activeOrgId,
  });

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'MEDIUM' },
  });

  const create = useMutation({
    mutationFn: (data: FormData) =>
      api.post('/tickets', { ...data, organizationId: activeOrgId }),
    onSuccess: (res) => {
      toast.success('Ticket criado com sucesso');
      router.push(`/tickets/${res.data.id}`);
    },
    onError: () => toast.error('Erro ao criar ticket'),
  });

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Novo Ticket</h1>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes do chamado</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(d => create.mutate(d))} className="space-y-5">
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

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Criando...' : 'Criar Ticket'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
