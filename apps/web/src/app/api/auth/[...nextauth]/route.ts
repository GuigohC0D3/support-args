import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import axios from 'axios';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 min
const REFRESH_BUFFER_MS = 60 * 1000; // renova 1 min antes de expirar
const SESSION_REMEMBER_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const SESSION_DEFAULT_MS = 8 * 60 * 60 * 1000; // 8 horas

async function refreshAccessToken(refreshToken: string) {
  const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { timeout: 5000 });
  return data as { accessToken: string; refreshToken: string };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        rememberMe: { label: 'Mantenha-me conectadotado', type: 'text' },
      },
      async authorize(credentials) {
        try {
          const { data } = await axios.post(
            `${API_URL}/auth/login`,
            { email: credentials?.email, password: credentials?.password },
            { timeout: 5000 },
          );
          return {
            ...data,
            email: credentials?.email,
            rememberMe: credentials?.rememberMe === 'true',
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // Primeiro login — inicializa o token com base na escolha do usuário
      if (user) {
        const rememberMe = (user as any).rememberMe === true;
        const sessionDuration = rememberMe ? SESSION_REMEMBER_MS : SESSION_DEFAULT_MS;

        return {
          accessToken: (user as any).accessToken,
          refreshToken: (user as any).refreshToken,
          accessTokenExpires: Date.now() + ACCESS_TOKEN_TTL_MS,
          sessionExpiresAt: Date.now() + sessionDuration,
          rememberMe,
          error: undefined,
        };
      }

      // Sessão global expirou (8h sem lembrar / 7 dias lembrando)
      if (Date.now() > (token.sessionExpiresAt as number)) {
        return { ...token, error: 'SessionExpired' as const };
      }

      // Access token ainda válido
      if (Date.now() < (token.accessTokenExpires as number) - REFRESH_BUFFER_MS) {
        return token;
      }

      // Access token expirado — renova silenciosamente
      try {
        const fresh = await refreshAccessToken(token.refreshToken as string);
        return {
          ...token,
          accessToken: fresh.accessToken,
          refreshToken: fresh.refreshToken,
          accessTokenExpires: Date.now() + ACCESS_TOKEN_TTL_MS,
          error: undefined,
        };
      } catch {
        return { ...token, error: 'RefreshAccessTokenError' as const };
      }
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      (session as any).error = token.error ?? null;
      (session as any).rememberMe = token.rememberMe ?? false;
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // cookie dura 7 dias; controle real está no token
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
