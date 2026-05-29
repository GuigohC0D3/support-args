'use client';

import { useQuery } from '@tanstack/react-query';
import { TicketIcon, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api-client';
import { cn } from '@/lib/utils';

const metricDefs = [
  { key: 'total',                 label: 'Total',           icon: TicketIcon,    accent: 'text-blue-500',    delay: 0   },
  { key: 'open',                  label: 'Abertos',         icon: AlertTriangle, accent: 'text-amber-500',   delay: 60  },
  { key: 'resolved',              label: 'Resolvidos',      icon: CheckCircle,   accent: 'text-emerald-500', delay: 120 },
  { key: 'avgFirstResponseHours', label: 'Resp. Média (h)', icon: Clock,         accent: 'text-violet-500',  delay: 180 },
];

function MetricCard({ label, value, icon: Icon, accent, delay }: {
  label: string; value: string | number; icon: any; accent: string; delay: number;
}) {
  return (
    <Card className="animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
      <CardContent className="p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground font-mono mb-3">
          {label}
        </p>
        <p className={cn('text-4xl font-black tabular-nums font-mono', accent)}>
          {value}
        </p>
        <Icon size={13} className={cn('mt-3 opacity-60', accent)} />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);

  const { data: metricsData } = useQuery({
    queryKey: ['dashboard-metrics', activeOrgId],
    queryFn: () => api.get(`/dashboard/metrics?organizationId=${activeOrgId}`).then(r => r.data),
    enabled: !!activeOrgId,
  });

  const { data: sla } = useQuery({
    queryKey: ['dashboard-sla', activeOrgId],
    queryFn: () => api.get(`/dashboard/sla?organizationId=${activeOrgId}`).then(r => r.data),
    enabled: !!activeOrgId,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b-2 border-border pb-4">
        <h1 className="text-xs font-black uppercase tracking-widest font-mono text-muted-foreground">
          Dashboard
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricDefs.map(({ key, label, icon, accent, delay }) => (
          <MetricCard
            key={key}
            label={label}
            value={metricsData?.[key] ?? 0}
            icon={icon}
            accent={accent}
            delay={delay}
          />
        ))}
      </div>

      {sla && (
        <Card className="animate-slide-up" style={{ animationDelay: '240ms' }}>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground font-mono">
                  SLA Compliance
                </p>
              </div>
              <span className="text-3xl font-black tabular-nums font-mono text-primary">
                {sla.complianceRate}%
              </span>
            </div>

            {/* Bar */}
            <div className="w-full bg-muted h-2">
              <div
                className="h-full bg-primary transition-all duration-700"
                style={{ width: `${sla.complianceRate}%` }}
              />
            </div>

            <div className="flex gap-6 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 bg-emerald-500 shrink-0" />
                <strong className="text-foreground">{sla.compliant}</strong> em dia
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 bg-destructive shrink-0" />
                <strong className="text-foreground">{sla.breached}</strong> violados
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 bg-amber-500 shrink-0" />
                <strong className="text-foreground">{sla.atRisk}</strong> em risco
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
