'use client';

import React from 'react';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { LogOut, ChevronsUpDown, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';

export function Header() {
  const { user, orgs, activeOrgId, setActiveOrg } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const initials = user?.name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  return (
    <header className="h-14 border-b-2 border-border bg-card flex items-center justify-between px-5 shrink-0">
      {/* Org switcher */}
      {orgs.length > 1 ? (
        <div className="relative">
          <select
            value={activeOrgId ?? ''}
            onChange={(e) => setActiveOrg((e.target as HTMLSelectElement).value)}
            className="appearance-none pl-3 pr-8 py-1.5 border-2 border-border text-sm bg-background font-semibold focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer transition-colors uppercase tracking-wide"
          >
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
          <ChevronsUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>
      ) : (
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {activeOrg?.name ?? ''}
        </span>
      )}

      {/* Right side */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="relative"
          aria-label="Alternar tema"
        >
          <Sun size={14} className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon size={14} className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Avatar + name */}
        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-7 h-7 border-2 border-primary flex items-center justify-center shrink-0 bg-primary/10">
            <span className="text-xs font-black text-primary font-mono">{initials}</span>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide hidden sm:block">
            {user?.name}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-muted-foreground hover:text-destructive ml-1"
          aria-label="Sair"
        >
          <LogOut size={14} />
        </Button>
      </div>
    </header>
  );
}
