// utils/config.js - Sistema de configuração seguro com validação
require('dotenv').config();

const assert = (condition, message) => {
    if (!condition) throw new Error(`[CONFIG ERROR] ${message}`);
};

// Detectar ambiente de produção (Railway ou NODE_ENV)
const isProd = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT_NAME;

const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    IS_PRODUCTION: isProd,
    
    // Discord Configuration
    DISCORD: {
        TOKEN: process.env.DISCORD_TOKEN,
        CLIENT_ID: process.env.CLIENT_ID,
        CLIENT_SECRET: process.env.CLIENT_SECRET,
        GUILD_ID: process.env.GUILD_ID,
    },
    
    // Website Configuration
    WEBSITE: {
        BASE_URL: process.env.BASE_URL || (isProd ? 'https://ysnmbot-alberto.up.railway.app' : 'http://localhost:4000'),
        SESSION_SECRET: process.env.SESSION_SECRET,
        PORT: parseInt(process.env.PORT) || 4000,
        CALLBACK_URL: process.env.CALLBACK_URL || '/auth/discord/callback',
    },
    
    // Channels Configuration
    CHANNELS: {
        UPDATES: process.env.UPDATES_CHANNEL_ID,
        VERIFICATION: process.env.VERIFICATION_CHANNEL_ID,
        LOGS: process.env.LOGS_CHANNEL_ID,
        TICKETS: process.env.TICKETS_CHANNEL_ID,
    },
    
    // Roles Configuration
    ROLES: {
        VERIFIED: process.env.VERIFIED_ROLE_ID,
        STAFF: process.env.STAFF_ROLE_ID,
        ADMIN: process.env.ADMIN_ROLE_ID,
        OWNER: process.env.OWNER_ROLE_ID,
    },
    
    // Database Configuration
    DATABASE: {
        PATH: process.env.DATABASE_PATH || './website/database/ysnm_dashboard.db',
    },
    
    // Webhooks Configuration
    WEBHOOKS: {
        LOGS: process.env.WEBHOOK_LOGS,
        UPDATES: process.env.WEBHOOK_UPDATES,
        TICKETS: process.env.WEBHOOK_TICKETS,
    },
    
    // Rate Limiting
    RATE_LIMIT: {
        WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    },
};

// Validações críticas
assert(config.DISCORD.TOKEN, 'DISCORD_TOKEN é obrigatório');
assert(config.DISCORD.CLIENT_ID, 'CLIENT_ID é obrigatório');
assert(config.DISCORD.CLIENT_SECRET, 'CLIENT_SECRET é obrigatório');
assert(config.DISCORD.GUILD_ID, 'GUILD_ID é obrigatório');
assert(config.WEBSITE.SESSION_SECRET, 'SESSION_SECRET é obrigatório (gere com: crypto.randomBytes(32).toString("hex"))');

// Validações de produção
if (isProd) {
    assert(config.WEBSITE.SESSION_SECRET.length >= 32, 'SESSION_SECRET deve ter pelo menos 32 caracteres em produção');
    assert(config.WEBSITE.BASE_URL.startsWith('https://'), 'BASE_URL deve usar HTTPS em produção');
}

// Log de inicialização (sem expor segredos)
console.log(`[CONFIG] Carregando configuração para ambiente: ${config.NODE_ENV}`);
console.log(`[CONFIG] URL base: ${config.WEBSITE.BASE_URL}`);
console.log(`[CONFIG] Porta: ${config.WEBSITE.PORT}`);
console.log(`[CONFIG] Guild ID: ${config.DISCORD.GUILD_ID}`);

module.exports = config;
