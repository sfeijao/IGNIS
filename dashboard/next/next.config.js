/**
 * Next.js configuration for IGNIS Dashboard refactor
 * We export to dashboard/public/next-export for simple hosting via Express static.
 */
const crypto = require('crypto');

const nextConfig = {
  // Switch to standalone to allow dynamic routes without static params
  output: 'standalone',
  distDir: '.next',
  basePath: '/next',
  assetPrefix: '/next/',
  trailingSlash: true,
  
  // Fix Server Action mismatch errors
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
      // Allow Server Actions from any origin (for Railway/proxy setups)
      allowedOrigins: ['*'],
    },
  },
  
  // Generate stable build ID based on content hash to prevent cache mismatches
  // Using a hash ensures consistent builds across deployments
  generateBuildId: async () => {
    // Use a stable identifier based on timestamp rounded to hour
    // This prevents constant rebuilds while still refreshing periodically
    const hourTimestamp = Math.floor(Date.now() / 3600000) * 3600000;
    return `build-${hourTimestamp}`;
  },
  
  // Disable static optimization for pages that use dynamic data
  // This prevents Server Action ID mismatches
  staticPageGenerationTimeout: 120,
  
  // Ensure proper headers for Server Actions
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
