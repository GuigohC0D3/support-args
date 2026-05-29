import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';

const priorityConfig: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  LOW:    { label: 'Baixa',   variant: 'gray' },
  MEDIUM: { label: 'Média',   variant: 'info' },
  HIGH:   { label: 'Alta',    variant: 'orange' },
  URGENT: { label: 'Urgente', variant: 'red' },
};

export function TicketPriorityBadge({ priority }: { priority: string }) {
  const config = priorityConfig[priority] ?? { label: priority, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
