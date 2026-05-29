import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default:     'border-primary/40 bg-primary/10 text-primary',
        secondary:   'border-border bg-secondary text-secondary-foreground',
        destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
        outline:     'border-border text-foreground',
        success:     'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        warning:     'border-amber-500/40   bg-amber-500/10   text-amber-600   dark:text-amber-400',
        info:        'border-blue-500/40    bg-blue-500/10    text-blue-600    dark:text-blue-400',
        purple:      'border-violet-500/40  bg-violet-500/10  text-violet-600  dark:text-violet-400',
        orange:      'border-orange-500/40  bg-orange-500/10  text-orange-600  dark:text-orange-400',
        red:         'border-red-500/40     bg-red-500/10     text-red-600     dark:text-red-400',
        gray:        'border-zinc-500/40    bg-zinc-500/10    text-zinc-600    dark:text-zinc-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
