import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    rememberMe?: boolean;
    error?: 'RefreshAccessTokenError' | 'SessionExpired' | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken:        string;
    refreshToken:       string;
    accessTokenExpires: number;
    sessionExpiresAt:   number;
    rememberMe:         boolean;
    error?:             'RefreshAccessTokenError' | 'SessionExpired';
  }
}
