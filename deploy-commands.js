#!/usr/bin/env node
// Thin wrapper to the unified deployer in scripts/deploy-commands.js
// Keeps compatibility with older instructions: `node deploy-commands.js`
try {
    const Deployer = require('./scripts/deploy-commands');
    const args = process.argv.slice(2);
    const options = {
        scope: args.includes('--global') ? 'global' : 'guild',
        list: args.includes('--list'),
        clear: args.includes('--clear'),
    };
    const d = new Deployer();
    d.run(options);
} catch (e) {
    console.error('Failed to run deploy-commands wrapper:', e && e.message ? e.message : e);
    process.exit(1);
}
