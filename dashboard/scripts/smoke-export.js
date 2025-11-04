#!/usr/bin/env node
// Quick static export sanity check
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'next', 'out');
const publicExport = path.join(root, 'public', 'next-export');

const requiredRoutes = [
  'index.html',
  path.join('tickets', 'index.html'),
  path.join('plugins', 'index.html'),
  path.join('settings', 'index.html'),
  path.join('webhooks', 'index.html'),
];

function checkDir(label, dir) {
  const errors = [];
  if (!fs.existsSync(dir)) {
    errors.push(`${label} not found: ${dir}`);
    return { ok: false, errors };
  }
  for (const rel of requiredRoutes) {
    const file = path.join(dir, rel);
    if (!fs.existsSync(file)) errors.push(`Missing ${label} file: ${rel}`);
  }
  return { ok: errors.length === 0, errors };
}

const results = [
  checkDir('out', outDir),
  checkDir('public export', publicExport),
];

const allOk = results.every(r => r.ok);
if (!allOk) {
  console.error('Smoke check failed:');
  for (const r of results) for (const e of r.errors) console.error(' -', e);
  process.exit(1);
}
console.log('Static export smoke check: PASS');
