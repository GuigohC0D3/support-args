'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider, useSession } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';
import api from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';

function StoreHydrator() {
  const { data: session, status } = useSession();
  const { setProfile } = useAuthStore();

  useEffect(() => {
    if (status !== 'authenticated') return;

    api.get('/users/me').then(({ data }) => {
      const orgs = data.organizations.map((o: any) => ({
        id: o.organizationId,
        name: o.organization.name,
        slug: o.organization.slug,
        role: o.role,
      }));
      setProfile(
        {
          id: data.id,
          name: data.name,
          email: data.email,
          avatarUrl: data.avatarUrl,
          isMasterAdmin: data.isMasterAdmin,
        },
        orgs,
      );
    });
  }, [status, setProfile]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, retry: 1 },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <StoreHydrator />
          {children}
          <Toaster richColors position="top-right" />
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
