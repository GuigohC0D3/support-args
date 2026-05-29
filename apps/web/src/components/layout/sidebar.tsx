'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Ticket, FolderOpen, Users, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/tickets',   label: 'Tickets',       icon: Ticket },
  { href: '/projects',  label: 'Projetos',      icon: FolderOpen },
  { href: '/users',     label: 'Usuários',      icon: Users },
  { href: '/settings',  label: 'Config',        icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r-2 border-border bg-card animate-slide-in-left">
      {/* Logo */}
      <div className="h-14 px-4 flex items-center border-b-2 border-border">
        <span className="font-black text-sm tracking-widest uppercase font-mono text-primary">
          Support/Hub
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-2',
                active
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground hover:border-border',
              )}
            >
              <Icon size={14} className="shrink-0" />
              <span className="uppercase tracking-wide text-xs font-semibold">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
