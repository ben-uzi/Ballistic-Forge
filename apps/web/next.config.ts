import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The engine ships as TypeScript source so web and React Native can share it unchanged.
  transpilePackages: ['@bf/engine'],
  async headers() {
    return [
      {
        // The service worker must be able to control the whole origin.
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
