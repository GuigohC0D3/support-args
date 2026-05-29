import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';

const statusConfig: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  OPEN:           { label: 'Aberto',            variant: 'info' },
  IN_PROGRESS:    { label: 'Em andamento',       variant: 'warning' },
  WAITING_CLIENT: { label: 'Aguardando cliente', variant: 'purple' },
  RESOLVED:       { label: 'Resolvido',          variant: 'success' },
  CLOSED:         { label: 'Fechado',            variant: 'gray' },
};

export function TicketStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
