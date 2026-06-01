'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Building2, User } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Tab = 'org' | 'profile';

export default function SettingsPage() {
  const qc = useQueryClient();
  const { activeOrgId, orgs, user, setProfile } = useAuthStore();
  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const isAdmin = activeOrg?.role === 'ORG_ADMIN' || user?.isMasterAdmin;

  const [tab, setTab] = useState<Tab>('org');

  // ─── Org form ───────────────────────────────────────────────────────────────
  const [orgForm, setOrgForm] = useState({ name: '', slug: '' });

  const { data: orgData } = useQuery({
    queryKey: ['org', activeOrgId],
    queryFn:  () => api.get(`/organizations/${activeOrgId}`).then((r) => r.data),
    enabled:  !!activeOrgId,
  });

  useEffect(() => {
    if (orgData) setOrgForm({ name: orgData.name, slug: orgData.slug });
  }, [orgData]);

  const saveOrg = useMutation({
    mutationFn: () => api.patch(`/organizations/${activeOrgId}`, orgForm),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['org', activeOrgId] });
      // Atualiza o nome no store
      const updatedOrgs = orgs.map((o) => o.id === activeOrgId ? { ...o, name: res.data.name, slug: res.data.slug } : o);
      setProfile(user!, updatedOrgs);
      toast.success('Organização atualizada');
    },
    onError: () => toast.error('Erro ao atualizar organização'),
  });

  // ─── Profile form ────────────────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({ name: '', avatarUrl: '' });

  useEffect(() => {
    if (user) setProfileForm({ name: user.name, avatarUrl: user.avatarUrl ?? '' });
  }, [user]);

  const saveProfile = useMutation({
    mutationFn: () => api.patch('/users/me', {
      name:      profileForm.name || undefined,
      avatarUrl: profileForm.avatarUrl || undefined,
    }),
    onSuccess: (res) => {
      setProfile({ ...user!, name: res.data.name, avatarUrl: res.data.avatarUrl }, orgs);
      toast.success('Perfil atualizado');
    },
    onError: () => toast.error('Erro ao atualizar perfil'),
  });

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'org',     label: 'Organização', icon: Building2 },
    { key: 'profile', label: 'Meu Perfil',  icon: User },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-black uppercase tracking-widest font-mono">Configurações</h1>

      {/* Tabs */}
      <div className="flex border-b-2 border-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 -mb-0.5 transition-colors',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Org tab ── */}
      {tab === 'org' && (
        <Card>
          <CardHeader>
            <CardTitle>Dados da organização</CardTitle>
            {!isAdmin && (
              <p className="text-xs text-muted-foreground">Apenas administradores podem editar.</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={orgForm.name}
                onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                disabled={!isAdmin}
                placeholder="Nome da organização"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input
                value={orgForm.slug}
                onChange={(e) => setOrgForm({ ...orgForm, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                disabled={!isAdmin}
                placeholder="minha-org"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Identificador único da organização. Apenas letras, números e hífens.</p>
            </div>

            {isAdmin && (
              <div className="flex justify-end pt-2">
                <Button size="sm" disabled={saveOrg.isPending || !orgForm.name.trim()} onClick={() => saveOrg.mutate()} className="gap-1.5">
                  <Save size={13} />
                  {saveOrg.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Profile tab ── */}
      {tab === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle>Meu perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={user?.email ?? ''} disabled className="font-mono text-muted-foreground" />
              <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
            </div>
            <div className="space-y-1.5">
              <Label>URL do avatar</Label>
              <Input
                value={profileForm.avatarUrl}
                onChange={(e) => setProfileForm({ ...profileForm, avatarUrl: e.target.value })}
                placeholder="https://..."
                className="font-mono"
              />
            </div>

            {profileForm.avatarUrl && (
              <div className="flex items-center gap-3">
                <img
                  src={profileForm.avatarUrl}
                  alt="Avatar preview"
                  className="w-10 h-10 border-2 border-border object-cover"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
                <span className="text-xs text-muted-foreground font-mono">Preview</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button size="sm" disabled={saveProfile.isPending || !profileForm.name.trim()} onClick={() => saveProfile.mutate()} className="gap-1.5">
                <Save size={13} />
                {saveProfile.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
