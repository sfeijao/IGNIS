/**
 * Clean Build Script for Next.js Dashboard
 * 
 * This script ensures a fresh build by:
 * 1. Removing the .next build folder
 * 2. Running a fresh build
 * 
 * Usage: node scripts/clean-build.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const NEXT_DIR = path.join(__dirname, '..');
const BUILD_DIR = path.join(NEXT_DIR, '.next');

console.log('🧹 Cleaning Next.js build directory...');

try {
    // Remove .next folder if exists
    if (fs.existsSync(BUILD_DIR)) {
        fs.rmSync(BUILD_DIR, { recursive: true, force: true });
        console.log('✅ Removed .next directory');
    } else {
        console.log('ℹ️  .next directory does not exist, skipping cleanup');
    }

    // Run build
    console.log('🔨 Starting fresh Next.js build...');
    execSync('npm run build', {
        cwd: NEXT_DIR,
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_ENV: 'production'
        }
    });

    console.log('✅ Clean build completed successfully!');
} catch (error) {
    console.error('❌ Clean build failed:', error.message);
    process.exit(1);
}
