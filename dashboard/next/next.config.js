/**
 * Next.js configuration for IGNIS Dashboard refactor
 * We export to dashboard/public/next-export for simple hosting via Express static.
 */
const nextConfig = {
  // Switch to standalone to allow dynamic routes without static params
  output: 'standalone',
  distDir: '.next',
  basePath: '/next',
  assetPrefix: '/next/',
  trailingSlash: true,
  
  // Prevent stale server action cache
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Generate unique build ID to prevent cache mismatches
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
};

module.exports = nextConfig;
