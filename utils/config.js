// utils/config.js - Sistema de configuração seguro com validação
require('dotenv').config();
const logger = require('../utils/logger');

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
        // Prefer a "safe" Railway domain by default (RAILWAY_URL or RAILWAY_STATIC_URL),
        // and only use the custom/public domain when explicitly forced. This avoids OAuth
        // failures while a custom domain's DNS is pending or misconfigured.
        BASE_URL: (() => {
            const explicit = process.env.BASE_URL && process.env.BASE_URL.trim();
            const forceCustom = (process.env.FORCE_CUSTOM_DOMAIN || '').toLowerCase() === 'true';

            // Railway provides multiple domain envs; prefer the app URL first as it's always valid
            const railwayUrl = (process.env.RAILWAY_URL || '').trim();
            const railwayStaticUrl = (process.env.RAILWAY_STATIC_URL || '').trim();
            const railwayPublicDomain = (process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();

            // Helper to normalize a domain or URL to https://host (no trailing slash for host-only)
            const normalizeToHttpsHost = (val) => {
                if (!val) return '';
                let url = /^https?:\/\//i.test(val) ? val : `https://${val}`;
                try {
                    const u = new URL(url);
                    // Keep protocol+host only to avoid leaking paths from envs
                    return `${u.protocol}//${u.hostname}`.replace(/\/$/, '');
                } catch {
                    return url.replace(/\/$/, '');
                }
            };

            // Determine the preferred Railway domain in production
            const preferredRailway = (() => {
                // Prefer the full app URL, then static URL, then the public domain
                if (railwayUrl) return normalizeToHttpsHost(railwayUrl);
                if (railwayStaticUrl) return normalizeToHttpsHost(railwayStaticUrl);
                if (railwayPublicDomain) return normalizeToHttpsHost(railwayPublicDomain);
                return '';
            })();

            if (explicit) {
                const base = explicit.replace(/\/$/, '');
                if (isProd) {
                    try {
                        const e = new URL(normalizeToHttpsHost(base));
                        // If forced, honor the explicit custom domain regardless of Railway envs
                        if (forceCustom) return `${e.protocol}//${e.hostname}`;
                        // Otherwise, prefer the safe Railway-provided URL if available and hosts differ
                        if (preferredRailway) {
                            const r = new URL(preferredRailway);
                            if (e.hostname !== r.hostname) {
                                const corrected = `${r.protocol}//${r.hostname}`;
                                console.warn(`[CONFIG WARNING] BASE_URL host (${e.hostname}) differs from Railway app URL (${r.hostname}). Using safe Railway URL: ${corrected} (set FORCE_CUSTOM_DOMAIN=true to keep custom domain)`);
                                return corrected;
                            }
                        }
                        return `${e.protocol}//${e.hostname}`;
                    } catch {
                        // If parsing explicit fails, fall back to preferred Railway or dev default
                        if (isProd && preferredRailway) return preferredRailway;
                        return 'http://localhost:4000';
                    }
                }
                return base;
            }

            if (isProd && preferredRailway) {
                return preferredRailway;
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

    // Deploy / command registration resilience configuration
    DEPLOY: {
        MAX_RETRIES: parseInt(process.env.COMMAND_DEPLOY_MAX_RETRIES) || 5,
        BASE_DELAY_MS: parseInt(process.env.COMMAND_DEPLOY_BASE_DELAY_MS) || 500,
        TIMEOUT_MS: parseInt(process.env.COMMAND_DEPLOY_TIMEOUT_MS) || 10000,
        JITTER_MS: parseInt(process.env.COMMAND_DEPLOY_JITTER_MS) || 250,
        // Allow disabling retry logic explicitly
        DISABLE_RETRY: (process.env.COMMAND_DEPLOY_DISABLE_RETRY || '').toLowerCase() === 'true'
    }
};

// Função de debug condicional: silêncio completo em ambiente de teste
function debugLog(){
    if (config.NODE_ENV === 'test') return; // suprime ruído nos testes
    console.log.apply(console, arguments);
}

// Validações críticas com debugging detalhado (silenciadas em test)
debugLog('[CONFIG DEBUG] Validating environment variables...');
debugLog('[CONFIG DEBUG] DISCORD_TOKEN present:', !!config.DISCORD.TOKEN);
debugLog('[CONFIG DEBUG] CLIENT_ID present:', !!config.DISCORD.CLIENT_ID);
debugLog('[CONFIG DEBUG] CLIENT_SECRET present:', !!config.DISCORD.CLIENT_SECRET);
debugLog('[CONFIG DEBUG] Environment:', config.NODE_ENV);
debugLog('[CONFIG DEBUG] Available env vars:', Object.keys(process.env).filter(key => key.includes('CLIENT') || key.includes('DISCORD')));

// Validações obrigatórias para funcionamento básico do bot
assert(config.DISCORD.TOKEN, 'DISCORD_TOKEN é obrigatório');
assert(config.DISCORD.CLIENT_ID, 'CLIENT_ID é obrigatório');
assert(config.DISCORD.GUILD_ID, 'GUILD_ID é obrigatório');

// SESSION_SECRET é obrigatório para o website
if (config.WEBSITE.SESSION_SECRET) {
    // Se SESSION_SECRET estiver presente, validar comprimento
    if (isProd && config.WEBSITE.SESSION_SECRET.length < 32) {
        const logger = require('./logger'); logger.warn('[CONFIG WARNING] SESSION_SECRET deve ter pelo menos 32 caracteres em produção');
    }
} else {
    // Gerar SESSION_SECRET temporário se não estiver definido
    const logger = require('./logger'); logger.warn('[CONFIG WARNING] SESSION_SECRET não definido, gerando temporário...');
    config.WEBSITE.SESSION_SECRET = require('crypto').randomBytes(32).toString('hex');
}

// CLIENT_SECRET é obrigatório apenas se o website for usado
if (!config.DISCORD.CLIENT_SECRET) {
    const logger = require('./logger');
    logger.warn('[CONFIG WARNING] CLIENT_SECRET não encontrado - funcionalidade do dashboard será limitada');
    logger.warn('[CONFIG WARNING] Defina DISCORD_CLIENT_SECRET ou CLIENT_SECRET para funcionalidade completa');
    // Para Railway, permitir operação sem CLIENT_SECRET inicialmente
    if (isProd) {
    logger.warn('[CONFIG WARNING] Modo bot-only ativado - dashboard desabilitado');
    config.DISCORD.CLIENT_SECRET = 'bot_only';
    }
} else {
    debugLog('[CONFIG DEBUG] CLIENT_SECRET encontrado - dashboard habilitado');
}

// Validações de produção
if (isProd) {
    assert(config.WEBSITE.SESSION_SECRET.length >= 32, 'SESSION_SECRET deve ter pelo menos 32 caracteres em produção');
    // Permitimos ambientes Railway auto-detectados, mas ainda exigimos HTTPS
    assert(/^https:\/\//.test(config.WEBSITE.BASE_URL), 'BASE_URL deve usar HTTPS em produção');
}

// Log de inicialização (sem expor segredos)
debugLog(`[CONFIG] Carregando configuração para ambiente: ${config.NODE_ENV}`);
debugLog(`[CONFIG] URL base: ${config.WEBSITE.BASE_URL}`);
if (isProd) {
    try {
        const details = {
            forceCustom: (process.env.FORCE_CUSTOM_DOMAIN || '').toLowerCase() === 'true',
            railwayUrl: process.env.RAILWAY_URL || null,
            railwayStaticUrl: process.env.RAILWAY_STATIC_URL || null,
            railwayPublicDomain: process.env.RAILWAY_PUBLIC_DOMAIN || null
        };
    debugLog('[CONFIG] Domain selection details:', details);
    } catch (e) { logger.debug('Caught error:', e?.message || e); }
}
debugLog(`[CONFIG] Porta: ${config.WEBSITE.PORT}`);
debugLog(`[CONFIG] Guild ID: ${config.DISCORD.GUILD_ID}`);

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
