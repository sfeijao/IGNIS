/**
 * Next.js configuration for IGNIS Dashboard refactor
 * We export to dashboard/public/next-export for simple hosting via Express static.
 */
const nextConfig = {
  output: 'export',
  distDir: '.next',
  // Serve under /next when hosted by Express
  basePath: '/next',
  // Ensure assets resolve correctly when nested
  assetPrefix: '/next/',
  trailingSlash: true,
};

module.exports = nextConfig;
