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
};

module.exports = nextConfig;
