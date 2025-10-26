#!/usr/bin/env node
// scripts/check-env.js - Quick environment sanity check
require('dotenv').config();
const url = require('url');
const config = require('../utils/config');

function ok(v){ return v != null && String(v).trim() !== ''; }

const out = [];
out.push(['DISCORD_TOKEN', ok(config.DISCORD.TOKEN)]);
out.push(['CLIENT_ID', ok(config.DISCORD.CLIENT_ID)]);
out.push(['GUILD_ID', ok(config.DISCORD.GUILD_ID)]);
out.push(['CLIENT_SECRET (dashboard)', ok(config.DISCORD.CLIENT_SECRET) ? 'present' : 'missing']);
out.push(['SESSION_SECRET', ok(config.WEBSITE.SESSION_SECRET) ? 'present' : 'missing (temp generated)']);

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || '';
out.push(['MONGO_URI|MONGODB_URI', ok(mongoUri)]);

const baseUrl = process.env.BASE_URL || config.WEBSITE.BASE_URL;
const callback = process.env.CALLBACK_URL || config.WEBSITE.CALLBACK_URL;
let hostMatch = 'unknown';
try { hostMatch = new url.URL(baseUrl).host === new url.URL(callback, baseUrl).host ? 'match' : 'MISMATCH'; } catch {}

const internalToken = process.env.INTERNAL_API_TOKEN || '';
out.push(['INTERNAL_API_TOKEN (bot→dashboard webhook)', ok(internalToken)]);

const corsOrigin = process.env.CORS_ORIGIN || '';
out.push(['CORS_ORIGIN (only if cross-origin frontend)', ok(corsOrigin) ? corsOrigin : 'disabled']);

console.log('IGNIS Env Check:\n=================');
for (const [k,v] of out) console.log(`- ${k}: ${v}`);
console.log(`- BASE_URL: ${baseUrl}`);
console.log(`- CALLBACK_URL: ${callback}`);
console.log(`- OAuth host alignment: ${hostMatch}`);

if (hostMatch === 'MISMATCH') {
  console.warn('\n[WARN] CALLBACK_URL host differs from BASE_URL host. Update one so they match exactly to avoid OAuth errors/loops.');
}

if (!ok(config.DISCORD.TOKEN) || !ok(config.DISCORD.CLIENT_ID) || !ok(config.DISCORD.GUILD_ID)) {
  console.error('\n[ERROR] Missing required Discord env vars. See .env.example and fill in your values.');
  process.exit(1);
}

console.log('\n✅ Env check completed.');
