import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isMasterAdmin: boolean;
}

interface AuthState {
  user: User | null;
  orgs: OrgInfo[];
  activeOrgId: string | null;
  setProfile: (user: User, orgs: OrgInfo[]) => void;
  setActiveOrg: (orgId: string) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      orgs: [],
      activeOrgId: null,

      setProfile: (user, orgs) =>
        set((state) => ({
          user,
          orgs,
          activeOrgId: state.activeOrgId ?? orgs[0]?.id ?? null,
        })),

      setActiveOrg: (activeOrgId) => set({ activeOrgId }),

      reset: () => set({ user: null, orgs: [], activeOrgId: null }),
    }),
    { name: 'support-hub:auth' },
  ),
);
