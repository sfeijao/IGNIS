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
        CLIENT_ID: process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID,
        CLIENT_SECRET: process.env.CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || process.env.CLIENTSECRET, // Handle typo
        GUILD_ID: process.env.GUILD_ID || process.env.DISCORD_GUILD_ID,
    },
    
    // Website Configuration
    WEBSITE: {
        // Prefer explicit BASE_URL; otherwise, in production infer from Railway's public domain
        // This keeps OAuth callback host aligned with the externally visible hostname
        BASE_URL: (() => {
            const explicit = process.env.BASE_URL && process.env.BASE_URL.trim();
            if (explicit) return explicit.replace(/\/$/, '');
            if (isProd) {
                const publicDomain = (process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_URL || process.env.RAILWAY_STATIC_URL || '').trim();
                if (publicDomain) return `https://${publicDomain.replace(/\/$/, '')}`;
            }
            // Dev fallback
            return 'http://localhost:4000';
        })(),
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
        PATH: process.env.DATABASE_PATH || './website/database/ignis_dashboard.db',
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

// Validações críticas com debugging detalhado
console.log('[CONFIG DEBUG] Validating environment variables...');
console.log('[CONFIG DEBUG] DISCORD_TOKEN present:', !!config.DISCORD.TOKEN);
console.log('[CONFIG DEBUG] CLIENT_ID present:', !!config.DISCORD.CLIENT_ID);
console.log('[CONFIG DEBUG] CLIENT_SECRET present:', !!config.DISCORD.CLIENT_SECRET);
console.log('[CONFIG DEBUG] Environment:', config.NODE_ENV);
console.log('[CONFIG DEBUG] Available env vars:', Object.keys(process.env).filter(key => key.includes('CLIENT') || key.includes('DISCORD')));

// Validações obrigatórias para funcionamento básico do bot
assert(config.DISCORD.TOKEN, 'DISCORD_TOKEN é obrigatório');
assert(config.DISCORD.CLIENT_ID, 'CLIENT_ID é obrigatório');
assert(config.DISCORD.GUILD_ID, 'GUILD_ID é obrigatório');

// SESSION_SECRET é obrigatório para o website
if (config.WEBSITE.SESSION_SECRET) {
    // Se SESSION_SECRET estiver presente, validar comprimento
    if (isProd && config.WEBSITE.SESSION_SECRET.length < 32) {
        console.warn('[CONFIG WARNING] SESSION_SECRET deve ter pelo menos 32 caracteres em produção');
    }
} else {
    // Gerar SESSION_SECRET temporário se não estiver definido
    console.warn('[CONFIG WARNING] SESSION_SECRET não definido, gerando temporário...');
    config.WEBSITE.SESSION_SECRET = require('crypto').randomBytes(32).toString('hex');
}

// CLIENT_SECRET é obrigatório apenas se o website for usado
if (!config.DISCORD.CLIENT_SECRET) {
    console.warn('[CONFIG WARNING] CLIENT_SECRET não encontrado - funcionalidade do dashboard será limitada');
    console.warn('[CONFIG WARNING] Defina DISCORD_CLIENT_SECRET ou CLIENT_SECRET para funcionalidade completa');
    // Para Railway, permitir operação sem CLIENT_SECRET inicialmente
    if (isProd) {
    console.warn('[CONFIG WARNING] Modo bot-only ativado - dashboard desabilitado');
    config.DISCORD.CLIENT_SECRET = 'bot_only';
    }
} else {
    console.log('[CONFIG DEBUG] CLIENT_SECRET encontrado - dashboard habilitado');
}

// Validações de produção
if (isProd) {
    assert(config.WEBSITE.SESSION_SECRET.length >= 32, 'SESSION_SECRET deve ter pelo menos 32 caracteres em produção');
    // Permitimos ambientes Railway auto-detectados, mas ainda exigimos HTTPS
    assert(/^https:\/\//.test(config.WEBSITE.BASE_URL), 'BASE_URL deve usar HTTPS em produção');
}

// Log de inicialização (sem expor segredos)
console.log(`[CONFIG] Carregando configuração para ambiente: ${config.NODE_ENV}`);
console.log(`[CONFIG] URL base: ${config.WEBSITE.BASE_URL}`);
console.log(`[CONFIG] Porta: ${config.WEBSITE.PORT}`);
console.log(`[CONFIG] Guild ID: ${config.DISCORD.GUILD_ID}`);

// Helper to return base URL in a stable way for callers
config.getBaseUrl = function() {
    try {
        if (config.WEBSITE && config.WEBSITE.BASE_URL) return config.WEBSITE.BASE_URL;
        const port = config.WEBSITE && config.WEBSITE.PORT ? config.WEBSITE.PORT : 4000;
        return `http://localhost:${port}`;
    } catch (e) {
        return 'http://localhost:4000';
    }
};

module.exports = config;
