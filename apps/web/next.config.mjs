/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@support-hub/types'],
  images: {
    remotePatterns: [{ hostname: '**' }],
  },
};

export default nextConfig;
