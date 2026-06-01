'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  rememberMe: z.boolean().default(false),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rememberMe: false },
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    const res = await signIn('credentials', {
      email: data.email,
      password: data.password,
      rememberMe: String(data.rememberMe),
      redirect: false,
    });
    setLoading(false);

    if (res?.error) {
      toast.error('Email ou senha inválidos');
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-4 animate-fade-in">
        <Card className="border-2">
          <CardHeader className="pb-4 pt-8 px-8 space-y-4">
            <div className="border-2 border-primary w-10 h-10 flex items-center justify-center">
              <span className="font-black text-primary font-mono text-sm">S/H</span>
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-xl font-black tracking-tight">Support Hub</CardTitle>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                Acesse sua conta
              </p>
            </div>
          </CardHeader>

          <CardContent className="pb-8 px-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs uppercase tracking-widest font-semibold">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="h-10 font-mono"
                />
                {errors.email && (
                  <p className="text-destructive text-xs font-mono">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-xs uppercase tracking-widest font-semibold"
                >
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  {...register('password')}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-10"
                />
                {errors.password && (
                  <p className="text-destructive text-xs font-mono">{errors.password.message}</p>
                )}
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-3 cursor-pointer select-none group pt-1">
                <input
                  type="checkbox"
                  {...register('rememberMe')}
                  className="w-4 h-4 accent-primary border-2 border-border cursor-pointer"
                />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                  Mantenha-me Conectado
                </span>
              </label>

              <Button
                type="submit"
                className="w-full h-10 mt-2 font-black uppercase tracking-widest"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Aguarde
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground font-mono pt-1">
                Sem marcar, a sessão expira em 8 horas.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
