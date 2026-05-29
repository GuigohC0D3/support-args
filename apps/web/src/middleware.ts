export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/tickets/:path*',
    '/projects/:path*',
    '/users/:path*',
    '/settings/:path*',
  ],
};
