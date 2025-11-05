// Copy Next.js static export from ./out to ../public/next-export and remove ./out to avoid linter noise
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'out');
const dest = path.join(__dirname, '..', '..', 'public', 'next-export');

try {
  if (!fs.existsSync(src)) {
    console.log('[after-build] No out/ directory found, skipping copy.');
    process.exit(0);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  // Remove intermediate out folder to keep workspace clean
  fs.rmSync(src, { recursive: true, force: true });
  console.log('[after-build] Export copied to public/next-export and out/ removed.');
} catch (err) {
  console.error('[after-build] Failed to finalize export:', err);
  // Do not fail the build if cleanup fails
  process.exit(0);
}
