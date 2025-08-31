const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const Database = require('../database/database');

const router = express.Router();

// Export a factory that accepts an initialized Database instance to avoid
// performing async initialization at module top-level (which can turn the
// module into an async/ESM graph and break require()).
module.exports = (database) => {
    const db = database || new Database();

const { sendArchivedTicketWebhook: sendArchivedWebhookWithRetries } = require('../utils/webhookSender');

// Use structured project logger (utils/logger.js)
const logger = require('../../utils/logger');

// In-memory recent logs kept for quick debug/UI access
const debugLogs = [];
const MAX_LOGS = 100;

function addDebugLog(level, message, data = null) {
    const payload = data && typeof data !== 'string' ? data : { data };
    // Keep a small in-memory copy for quick UI access
    try {
        const entry = { timestamp: new Date().toISOString(), level, message, data };
        debugLogs.push(entry);
        if (debugLogs.length > MAX_LOGS) debugLogs.shift();
    } catch (e) {
        // ignore
    }

    // Forward to structured logger
    try {
        switch ((level || 'info').toLowerCase()) {
            case 'error':
                logger.error(message, payload);
                break;
            case 'warn':
                logger.warn(message, payload);
                break;
            case 'debug':
                logger.debug(message, payload);
                break;
            case 'trace':
                logger.trace ? logger.trace(message, payload) : logger.debug(message, payload);
                break;
            default:
                logger.info(message, payload);
        }
    } catch (e) {
        // Final fallback: try logger's info/warn/error directly but swallow errors
        try {
            if ((level || 'info').toLowerCase() === 'error') logger.error(message, payload);
            else if ((level || 'info').toLowerCase() === 'warn') logger.warn(message, payload);
            else logger.info(message, payload);
        } catch (ee) {
            // swallow
        }
    }
}

    // Variável para controlar se a database foi inicializada
    let dbInitialized = false;

    // Note: we do not call db.initialize() here synchronously. The server
    // startup path should initialize the database earlier and pass the
    // instance to this factory. If not initialized, ensureDbReady will
    // initialize lazily on first request.

// Middleware para verificar se database está pronta
    const ensureDbReady = async (req, res, next) => {
        if (!dbInitialized || !db.db) {
            try {
                await db.initialize();
                dbInitialized = true;
            } catch (error) {
                addDebugLog('error', '❌ Erro ao inicializar database', { error: error.message });
                return res.status(500).json({ error: 'Database não disponível' });
            }
        }
        // Passar a instância da database para a requisição
        req.db = db;
        next();
    };

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Muitas requisições, tente novamente em 15 minutos' }
});

router.use(apiLimiter);

// Export-specific rate limiter: prevent mass downloads
const exportLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: { error: 'Limite de exportação atingido. Tente novamente em 1 minuto.' }
});

// Middleware para definir serverId
router.use((req, res, next) => {
    // Get server ID from various sources
    req.currentServerId = req.params.serverId || 
                         req.query.guildId || 
                         req.body.guildId ||
                         process.env.GUILD_ID || 
                         '1404259700554768406'; // Default server ID
    next();
});

// Middleware de autenticação unificado
const requireAuth = (req, res, next) => {
    // Check for Bearer token in Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        // Determine environment
        const isProd = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT_NAME || !!process.env.RAILWAY_PROJECT_NAME;
        const allowDev = !isProd || process.env.ALLOW_DEV_TOKENS === 'true';

        // If an explicit ADMIN_API_TOKEN is set, accept it in any environment
        const adminApiToken = process.env.ADMIN_API_TOKEN;

        const validDevTokens = [ 'dev-token', 'admin-token', 'dashboard-token', 'local-dev' ];

        if (token) {
            if (adminApiToken && token === adminApiToken) {
                req.user = { id: 'admin_token_user', isAdmin: true, token };
                logger.info('✅ Authenticated with ADMIN_API_TOKEN');
                return next();
            }

            if (allowDev && validDevTokens.includes(token)) {
                req.user = { id: '381762006329589760', isAdmin: true, token };
                logger.info('✅ Authenticated with dev token: %s...', token.substring(0, 8));
                return next();
            }

            // Otherwise, do not accept arbitrary short tokens. Require session or configured ADMIN_API_TOKEN.
            logger.warn('❌ Bearer token rejected', { tokenPreview: token.substring(0, 8), isProd, allowDev });
        }
    }
    
    // Only allow an explicit local bypass. This avoids automatically
    // authenticating requests just because they come from localhost.
    const allowLocalBypass = process.env.ALLOW_LOCAL_AUTH_BYPASS === 'true';
    if (allowLocalBypass) {
        req.user = { id: '381762006329589760', isAdmin: true };
        logger.info('✅ ALLOW_LOCAL_AUTH_BYPASS enabled: authenticated via local bypass');
        return next();
    }
    
    // Check Passport OAuth authentication
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        logger.info('✅ Authenticated via OAuth session');
        return next();
    }
    
    logger.warn('❌ Authentication failed', {
        hasAuthHeader: !!authHeader,
        token: authHeader ? authHeader.substring(7, 15) + '...' : 'none',
        host: req.get('host'),
        isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
        hasUser: !!req.user
    });
    
    return res.status(401).json({ 
        error: 'Não autorizado',
        hint: 'Use Bearer token ou faça login via Discord OAuth'
    });
};

// Session server selection endpoints
// GET /api/session/server -> returns currently selected guild in session
// POST /api/session/server { guildId } -> sets req.session.guild to a minimal guild object
router.get('/session/server', requireAuth, async (req, res) => {
    try {
        if (req.session && req.session.guild) {
            return res.json({ success: true, guild: req.session.guild });
        }
        return res.json({ success: true, guild: null });
    } catch (error) {
        logger.error('Erro ao obter server da sessão', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/session/server', requireAuth, async (req, res) => {
    try {
        const { guildId } = req.body;
        if (!guildId) return res.status(400).json({ error: 'guildId é obrigatório' });

        // Try to resolve full guild info via bot client
        let guildObj = null;
        if (global.discordClient && global.discordClient.isReady()) {
            let guild = global.discordClient.guilds.cache.get(guildId);
            if (!guild) {
                guild = await global.discordClient.guilds.fetch(guildId).catch(() => null);
            }
            if (guild) {
                guildObj = {
                    id: guild.id,
                    name: guild.name,
                    icon: guild.icon || null,
                    memberCount: guild.memberCount || (guild.members ? guild.members.cache.size : null)
                };
            }
        }

        // Fallback minimal object
        if (!guildObj) {
            guildObj = { id: guildId, name: `Guild ${guildId}`, icon: null, memberCount: null };
        }

        // Persist in session
        req.session.guild = guildObj;
        // Also set currentServerId helper for middleware that reads req.currentServerId
        req.currentServerId = guildId;

        res.json({ success: true, guild: guildObj });
    } catch (error) {
        logger.error('Erro ao definir server na sessão', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Middleware de validação de admin
const requireAdmin = (req, res, next) => {
    // Check for Bearer token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        const isProd = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT_NAME || !!process.env.RAILWAY_PROJECT_NAME;
        const allowDev = !isProd || process.env.ALLOW_DEV_TOKENS === 'true';
        const adminApiToken = process.env.ADMIN_API_TOKEN;
        const validDevTokens = [ 'dev-token', 'admin-token', 'dashboard-token', 'local-dev' ];

        if (token) {
            if (adminApiToken && token === adminApiToken) {
                req.user = { id: 'admin_token_user', isAdmin: true, token };
                logger.info('✅ Authenticated admin with ADMIN_API_TOKEN');
                return next();
            }
            if (allowDev && validDevTokens.includes(token)) {
                req.user = { id: '381762006329589760', isAdmin: true, token };
                logger.info('✅ Authenticated via dev token: %s...', token.substring(0, 8));
                return next();
            }

            logger.warn('❌ Admin Bearer token rejected', { tokenPreview: token.substring(0, 8), isProd, allowDev });
        }
    }
    
    // Only allow explicit local bypass for admin actions
    const allowLocalBypass = process.env.ALLOW_LOCAL_AUTH_BYPASS === 'true';
    if (allowLocalBypass) {
        req.user = { id: '381762006329589760', isAdmin: true };
        logger.info('✅ ALLOW_LOCAL_AUTH_BYPASS enabled: authenticated admin via local bypass');
        return next();
    }
    
    // Fallback to session authentication
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        logger.info('✅ Authenticated via session');
        return next();
    }
    
    logger.warn('❌ Authentication failed', {
        hasAuthHeader: !!authHeader,
        token: authHeader ? authHeader.substring(7, 15) + '...' : 'none',
        host: req.get('host'),
        referer: req.get('referer'),
        remoteAddress: req.connection?.remoteAddress
    });
    
    return res.status(403).json({ 
        error: 'Permissões insuficientes. Token de autenticação necessário.',
        details: 'Use um token Bearer válido (dev-token, admin-token) ou acesse via localhost.',
        validTokens: ['dev-token', 'admin-token', 'dashboard-token']
    });
};

// Middleware: verify user is a guild admin via stored admin_roles or fallback to requireAdmin
const requireGuildAdmin = async (req, res, next) => {
    try {
        // If user is already marked admin by requireAuth session/token, allow
        if (req.user && req.user.isAdmin) return next();

        const guildId = req.currentServerId;
        const rolesConfig = await db.getGuildConfig(guildId, 'admin_roles');

        // If no roles configured, fallback to existing token/session admin check
        if (!rolesConfig || !rolesConfig.value) {
            return requireAdmin(req, res, next);
        }

        const adminRoles = rolesConfig.value.split(',').map(r => r.trim()).filter(Boolean);

        // If no discord client available, deny
        if (!global.discordClient || !global.discordClient.isReady || !global.discordClient.isReady()) {
            // Fallback to requireAdmin
            return requireAdmin(req, res, next);
        }

        // Ensure req.user exists (from OAuth session)
        if (!req.user || !req.user.id) return res.status(403).json({ error: 'Permissões insuficientes' });

        const guild = global.discordClient.guilds.cache.get(guildId);
        let member = null;
        try {
            if (guild) {
                member = await guild.members.fetch(req.user.id);
            } else {
                // Try REST fetch via client
                member = await global.discordClient.users.fetch(req.user.id).then(user => null).catch(() => null);
            }
        } catch (err) {
            // If fetching fails, fallback to requireAdmin
            return requireAdmin(req, res, next);
        }

        if (!member) return requireAdmin(req, res, next);

        const hasAdminRole = member.roles.cache.some(r => adminRoles.includes(r.id) || adminRoles.includes(r.name));
        if (hasAdminRole) return next();

        return res.status(403).json({ error: 'Permissões insuficientes. Apenas administradores do servidor podem executar esta ação.' });
    } catch (err) {
        logger.error('Erro ao verificar roles de admin', { error: err && err.message ? err.message : err, stack: err && err.stack });
        return requireAdmin(req, res, next);
    }
};

// === ANALYTICS ROUTES ===

// Overview stats
router.get('/analytics/overview', requireAuth, async (req, res) => {
    try {
        const { period = '7d', guildId } = req.query;
        
        // Use guildId from query or from config
        const targetGuildId = guildId || process.env.GUILD_ID || '1404259700554768406';
        
        const stats = await db.getAnalyticsOverview(targetGuildId, period);
        
        res.json({
            success: true,
            stats: {
                messages: stats.messages || 0,
                activeMembers: stats.activeMembers || 0,
                voiceTime: stats.voiceTime || 0,
                commands: stats.commands || 0,
                moderation: stats.moderation || 0
            }
        });
    } catch (error) {
        logger.error('Erro ao buscar overview analytics', { error: error && error.message ? error.message : error, stack: error && error.stack });
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Messages analytics
router.get('/analytics/messages', requireAuth, async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        const guildId = req.session.guild.id;
        
        const data = await db.getMessagesAnalytics(guildId, period);
        
        res.json({
            success: true,
            labels: data.labels,
            values: data.values,
            change: data.change
        });
    } catch (error) {
        logger.error('Erro ao buscar analytics de mensagens', { error: error && error.message ? error.message : error, stack: error && error.stack });
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Members analytics
router.get('/analytics/members', requireAuth, async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        const guildId = req.session.guild.id;
        
        const data = await db.getMembersAnalytics(guildId, period);
        
        res.json({
            success: true,
            labels: data.labels,
            values: data.values,
            change: data.change
        });
    } catch (error) {
        logger.error('Erro ao buscar analytics de membros', { error: error && error.message ? error.message : error, stack: error && error.stack });
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Commands analytics
router.get('/analytics/commands', requireAuth, async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        const guildId = req.session.guild.id;
        
        const data = await db.getCommandsAnalytics(guildId, period);
        
        res.json({
            success: true,
            labels: data.labels,
            values: data.values
        });
    } catch (error) {
        logger.error('Erro ao buscar analytics de comandos', { error: error && error.message ? error.message : error, stack: error && error.stack });
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Hourly analytics
router.get('/analytics/hourly', requireAuth, async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        const guildId = req.session.guild.id;
        
        const data = await db.getHourlyAnalytics(guildId, period);
        
        res.json({
            success: true,
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            values: data
        });
    } catch (error) {
        logger.error('Erro ao buscar analytics por hora', { error: error && error.message ? error.message : error, stack: error && error.stack });
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Moderation analytics
router.get('/analytics/moderation', requireAuth, async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        const guildId = req.session.guild.id;
        
        const data = await db.getModerationAnalytics(guildId, period);
        
        res.json({
            success: true,
            labels: data.labels,
            values: data.values
        });
    } catch (error) {
        logger.error('Erro ao buscar analytics de moderação', { error: error && error.message ? error.message : error, stack: error && error.stack });
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ----- Guild config admin endpoints -----
// Get guild config (selected keys)
router.get('/admin/guild-config/:guildId', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const guildId = req.params.guildId;
        const keys = ['archive_webhook_url', 'log_channel_id', 'ticket_category_id', 'staff_role_id', 'verify_role_id'];
        const out = {};
        for (const key of keys) {
            const cfg = await db.getGuildConfig(guildId, key);
            out[key] = cfg ? cfg.value : null;
        }
        res.json({ success: true, guildId, config: out });
    } catch (error) {
        logger.error('Erro ao obter guild config', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Update guild config
router.post('/admin/guild-config/:guildId', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const guildId = req.params.guildId;
        const payload = req.body || {};
        const allowed = ['archive_webhook_url', 'log_channel_id', 'ticket_category_id', 'staff_role_id', 'verify_role_id'];
        const updated = {};
        for (const key of allowed) {
            if (Object.prototype.hasOwnProperty.call(payload, key)) {
                const value = payload[key] === null ? null : String(payload[key]);
                await db.setGuildConfig(guildId, key, value);
                updated[key] = value;
            }
        }
        res.json({ success: true, guildId, updated });
    } catch (error) {
        logger.error('Erro ao atualizar guild config', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno' });
    }
});

// List known guilds (simple list from guild_config or guilds table)
router.get('/admin/guilds', requireAuth, ensureDbReady, async (req, res) => {
    try {
        // Prefer explicit guilds table if present
        const rows = await new Promise((resolve, reject) => {
            db.db.all('SELECT DISTINCT guild_id FROM guild_config', (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map(r => r.guild_id));
            });
        });
        res.json({ success: true, guilds: rows });
    } catch (error) {
        logger.error('Erro ao listar guilds para admin', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Moderation action endpoint (kick/ban/timeout/role)
router.post('/admin/moderation/action', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const { guildId, action, targetId, durationSeconds = 0, roleId, reason = 'Moderation via dashboard' } = req.body;

        if (!global.discordClient || !global.discordClient.isReady || !global.discordClient.isReady()) {
            return res.status(503).json({ error: 'Discord client não disponível no servidor' });
        }

        const guild = global.discordClient.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ error: 'Guild não encontrada pelo bot' });

        const member = await guild.members.fetch(targetId).catch(() => null);
        if (!member) return res.status(404).json({ error: 'Membro não encontrado' });

        if (action === 'kick') {
            await member.kick(reason);
            await db.createLog({ guild_id: guildId, type: 'moderation', message: `Kicked ${targetId}`, details: { action, reason, actor: req.user?.id } });
            return res.json({ success: true });
        }

        if (action === 'ban') {
            await guild.bans.create(targetId, { reason });
            await db.createLog({ guild_id: guildId, type: 'moderation', message: `Banned ${targetId}`, details: { action, reason, actor: req.user?.id } });
            return res.json({ success: true });
        }

        if (action === 'timeout') {
            // timeout is available via member.timeout in newer discord.js
            if (typeof member.timeout === 'function') {
                await member.timeout(durationSeconds * 1000, reason);
                await db.createLog({ guild_id: guildId, type: 'moderation', message: `Timed out ${targetId} for ${durationSeconds}s`, details: { action, reason, actor: req.user?.id } });
                return res.json({ success: true });
            }
            return res.status(400).json({ error: 'Timeout não suportado pela versão do client' });
        }

        if (action === 'addRole' || action === 'removeRole') {
            if (!roleId) return res.status(400).json({ error: 'roleId required' });
            if (action === 'addRole') await member.roles.add(roleId, reason);
            else await member.roles.remove(roleId, reason);
            await db.createLog({ guild_id: guildId, type: 'moderation', message: `${action} ${roleId} for ${targetId}`, details: { action, roleId, actor: req.user?.id } });
            return res.json({ success: true });
        }

        return res.status(400).json({ error: 'Ação desconhecida' });
    } catch (error) {
        logger.error('Erro em admin moderation action', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Activity feed
router.get('/analytics/activity', requireAuth, async (req, res) => {
    try {
        const guildId = req.session.guild.id;
        const activities = await db.getRecentActivity(guildId, 20);
        
        res.json({
            success: true,
            activities
        });
    } catch (error) {
        logger.error('Erro ao buscar atividades', { error: error && error.message ? error.message : error, stack: error && error.stack });
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// === TICKETS ROUTES ===

// Current user info (for UI to show admin-only controls)
router.get('/me', requireAuth, (req, res) => {
    try {
        const user = req.user || null;
        res.json({ success: true, user: { id: user?.id || null, isAdmin: !!user?.isAdmin } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Unable to retrieve user info' });
    }
});


// Get all tickets
router.get('/tickets', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const { status, priority, assigned } = req.query;
        const guildId = req.currentServerId;
        
    logger.info('🎫 Buscando tickets para guild', { guildId, params: { status, priority, assigned } });
        
        // Verificar se a database está inicializada
        if (!db.db) {
            logger.error('❌ Database não inicializada');
            return res.status(500).json({ error: 'Database não inicializada' });
        }
        
        // Criar filtros baseados nos parâmetros
        const filters = {};
        if (status && status !== '') filters.status = status;
        if (priority && priority !== '') filters.priority = priority;
        if (assigned && assigned !== '') filters.assigned_to = assigned;
        
        // Paging and search support
        const page = parseInt(req.query.page || '1', 10) || 1;
        const pageSize = Math.min(parseInt(req.query.pageSize || '50', 10) || 50, 200);
        const q = req.query.q ? String(req.query.q).trim() : null;

        let tickets = await db.getTickets(guildId, filters.status);


        // Additional server-side filters
        const severity = req.query.severity ? String(req.query.severity).trim() : null;
        const userId = req.query.userId ? String(req.query.userId).trim() : null;
        const from = req.query.from ? new Date(req.query.from) : null;
        const to = req.query.to ? new Date(req.query.to) : null;

        // Apply server-side search (title, subject, description)
        if (q) {
            const qLower = q.toLowerCase();
            tickets = tickets.filter(t => (
                (t.title || '').toLowerCase().includes(qLower) ||
                (t.subject || '').toLowerCase().includes(qLower) ||
                (t.description || '').toLowerCase().includes(qLower)
            ));
        }

        if (severity) tickets = tickets.filter(t => (t.severity || '').toLowerCase() === severity.toLowerCase());
        if (userId) tickets = tickets.filter(t => t.user_id === userId);
        if (from) tickets = tickets.filter(t => new Date(t.created_at) >= from);
        if (to) tickets = tickets.filter(t => new Date(t.created_at) <= to);

        // Pagination
        const total = tickets.length;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paged = tickets.slice(start, end);
        
        // Filtrar tickets corrompidos (título null ou vazio) e adicionar limpeza automática
        const validTickets = tickets.filter(ticket => {
            const isValid = ticket.title && 
                           ticket.title !== 'null' && 
                           ticket.title !== 'undefined' && 
                           ticket.title.trim() !== '';
            
            if (!isValid) {
                logger.warn(`⚠️ Ticket corrompido encontrado`, { ticketId: ticket.id, title: ticket.title });
                // Agendar limpeza assíncrona (não bloqueante)
                setImmediate(async () => {
                    try {
                        logger.info('🗑️ Auto-limpeza: removendo ticket corrompido', { ticketId: ticket.id });
                        await db.deleteTicket(ticket.id);
                    } catch (error) {
                        logger.error(`❌ Erro na auto-limpeza do ticket ${ticket.id}:`, { error: error && error.message ? error.message : error });
                    }
                });
            }
            
            return isValid;
        });
        
        // Aplicar filtros adicionais se necessário
        let filteredTickets = validTickets;
        if (filters.priority) {
            filteredTickets = filteredTickets.filter(t => t.priority === filters.priority);
        }
        if (filters.assigned_to) {
            filteredTickets = filteredTickets.filter(t => t.assigned_to === filters.assigned_to);
        }
        
        res.json({
            success: true,
            tickets: filteredTickets,
            meta: { total, page, pageSize }
        });
    } catch (error) {
    logger.error('Erro ao buscar tickets', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
});

// Get ticket stats
router.get('/tickets/stats', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const guildId = req.currentServerId;
        
    logger.info('📊 Buscando estatísticas de tickets para guild', { guildId });
        
        const stats = await db.getTicketStats(guildId);
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
    logger.error('Erro ao buscar estatísticas de tickets', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
});

// Export archived tickets as CSV (admin-only)
router.get('/tickets/export', requireAuth, requireGuildAdmin, exportLimiter, ensureDbReady, async (req, res) => {
    try {
        const guildId = req.currentServerId;
        // Use existing filters: allow q, severity, from, to via query
        const status = 'archived';
        // Fetch archived tickets (server-side filtering already handles archived status)
        const tickets = await db.getTickets(guildId, status);

        // Optional server-side filtering
        const q = req.query.q ? String(req.query.q).trim().toLowerCase() : null;
        const severity = req.query.severity ? String(req.query.severity).trim().toLowerCase() : null;
        const from = req.query.from ? new Date(req.query.from) : null;
        const to = req.query.to ? new Date(req.query.to) : null;

        let rows = tickets;
        if (q) {
            rows = rows.filter(t => ((t.title||'') + ' ' + (t.subject||'') + ' ' + (t.description||'')).toLowerCase().includes(q));
        }
        if (severity) rows = rows.filter(t => (t.severity||'').toLowerCase() === severity);
        if (from) rows = rows.filter(t => new Date(t.created_at) >= from);
        if (to) rows = rows.filter(t => new Date(t.created_at) <= to);

        // Build CSV
        const columns = ['id','channel_id','user_id','title','subject','description','severity','category','status','created_at','closed_at','closed_by','closed_reason'];
        const escape = v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
        const csv = [columns.join(',')].concat(rows.map(r => columns.map(c => escape(r[c])).join(','))).join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="tickets-archived-${guildId}.csv"`);
        // Audit log: record export action
        try {
            await db.createLog(guildId, 'export_tickets', {
                requestedBy: req.user?.id || null,
                filters: { q: req.query.q || null, severity: req.query.severity || null, from: req.query.from || null, to: req.query.to || null },
                exportedAt: new Date().toISOString()
            });
        } catch (logErr) {
            addDebugLog('warn', 'Falha ao registar log de exportação', { error: logErr.message });
        }

        res.send(csv);
    } catch (error) {
        logger.error('Erro ao exportar tickets arquivados', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro ao exportar tickets' });
    }
});

// Create ticket
router.post('/tickets', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const schema = Joi.object({
            title: Joi.string().min(3).max(100).required(),
            reason: Joi.string().max(1000).optional().default('Sem descrição fornecida'),
            severity: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
            userId: Joi.string().optional().allow(null),
            priority: Joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
            category: Joi.string().max(50).optional().default('general'),
            createdBy: Joi.string().optional().default('dashboard')
        });
        
        addDebugLog('info', '🎫 Request body recebido', req.body);
        
        const { error, value } = schema.validate(req.body);
        if (error) {
            addDebugLog('error', '❌ Erro de validação', { error: error.details[0].message, data: req.body });
            return res.status(400).json({ error: error.details[0].message });
        }
        
        const guildId = req.currentServerId;
        const requesterId = req.user.id;
        const requesterUsername = req.user.username;
        const targetUserId = value.userId || requesterId; // Usar o usuário especificado ou o próprio usuário
        
        addDebugLog('info', '🎫 Criando ticket para', { 
            guildId, 
            requesterId, 
            targetUserId, 
            requesterUsername, 
            title: value.title,
            severity: value.severity 
        });
        
        // Verificar se o bot está online e tem acesso ao servidor
        if (!global.discordClient || !global.discordClient.isReady()) {
            addDebugLog('error', '❌ Bot do Discord não está disponível');
            return res.status(503).json({ error: 'Bot do Discord não está disponível' });
        }
        
        const guild = global.discordClient.guilds.cache.get(guildId);
        if (!guild) {
            addDebugLog('error', '❌ Servidor não encontrado', { guildId });
            return res.status(404).json({ error: 'Servidor não encontrado' });
        }
        
        addDebugLog('info', '🏠 Servidor encontrado', { name: guild.name, id: guild.id });
        
        // Verificar permissões do bot
        const botMember = guild.members.cache.get(global.discordClient.user.id);
        if (!botMember) {
            addDebugLog('error', '❌ Bot não está no servidor');
            return res.status(403).json({ error: 'Bot não tem acesso ao servidor' });
        }
        
        const requiredPermissions = ['ManageChannels', 'ViewChannel', 'SendMessages'];
        const missingPermissions = requiredPermissions.filter(perm => !botMember.permissions.has(perm));
        
        if (missingPermissions.length > 0) {
            logger.error('❌ Bot não tem permissões necessárias', { missingPermissions });
            return res.status(403).json({ 
                error: 'Bot não tem permissões necessárias',
                missingPermissions 
            });
        }
        
    logger.info('✅ Bot tem todas as permissões necessárias');

        // Verificar se o usuário alvo existe no servidor
        let targetMember;
        try {
            logger.info('👤 Procurando usuário: %s', targetUserId);
            targetMember = await guild.members.fetch(targetUserId);
            logger.info('✅ Usuário encontrado: %s', targetMember.displayName);
        } catch (error) {
            logger.error('❌ Erro ao buscar usuário', { error: error && error.message ? error.message : error });
            return res.status(404).json({ error: 'Usuário não encontrado no servidor' });
        }
        
        // Buscar categoria de tickets (ou criar se não existir)
        let ticketCategory = guild.channels.cache.find(
            channel => channel.type === 4 && channel.name.toLowerCase() === 'tickets'
        );
        
        if (!ticketCategory) {
            logger.info('📁 Criando categoria de tickets...');
            try {
                ticketCategory = await guild.channels.create({
                    name: 'Tickets',
                    type: 4, // Category
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone,
                            deny: ['ViewChannel']
                        }
                    ]
                });
                logger.info('✅ Categoria de tickets criada: %s', ticketCategory.name);
            } catch (error) {
                logger.error('❌ Erro ao criar categoria de tickets', { error: error && error.message ? error.message : error });
                return res.status(500).json({ 
                    error: 'Erro ao criar categoria de tickets',
                    details: error.message 
                });
            }
        } else {
            logger.info('✅ Categoria de tickets encontrada: %s', ticketCategory.name);
        }
        
        // Criar canal do ticket
        const ticketChannelName = `ticket-${targetMember.displayName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-6)}`;
    logger.info('🎫 Criando canal: %s', ticketChannelName);
        
        let ticketChannel;
        try {
            ticketChannel = await guild.channels.create({
                name: ticketChannelName,
                type: 0, // Text channel
                parent: ticketCategory.id,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        deny: ['ViewChannel']
                    },
                    {
                        id: targetUserId,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                    },
                    // Se o criador for diferente do usuário alvo, dar permissões também
                    ...(requesterId !== targetUserId ? [{
                        id: requesterId,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                    }] : []),
                    // Permitir que moderadores vejam
                    ...guild.roles.cache
                        .filter(role => role.permissions.has('ManageMessages'))
                        .map(role => ({
                            id: role.id,
                            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
                        }))
                ]
            });
            logger.info('✅ Canal criado com sucesso: %s ID: %s', ticketChannel.name, ticketChannel.id);
        } catch (error) {
            logger.error('❌ Erro ao criar canal do ticket', { error: error && error.message ? error.message : error });
            return res.status(500).json({ 
                error: 'Erro ao criar canal do ticket',
                details: error.message 
            });
        }
        
        // Criar ticket na base de dados
        const db = req.db;
        const ticketData = {
            guild_id: guildId,
            channel_id: ticketChannel.id,
            user_id: targetUserId,
            category: value.category,
            title: value.title,
            subject: value.title, // Manter compatibilidade
            description: value.reason,
            severity: value.severity,
            priority: value.priority
        };
        
        const ticketResult = await db.createTicket(ticketData);
        
        // Adicionar usuário ao ticket na tabela ticket_users
        await db.addUserToTicket(ticketResult.id, targetUserId);
        
        // Se o criador for diferente do usuário alvo, adicionar também
        if (requesterId !== targetUserId) {
            await db.addUserToTicket(ticketResult.id, requesterId);
        }
        
        // Enviar mensagem inicial no canal do ticket
        const severityEmojis = {
            low: '🟢',
            medium: '🟡', 
            high: '🟠',
            urgent: '🔴'
        };
        
        const embed = {
            color: value.severity === 'urgent' ? 0xFF0000 : value.severity === 'high' ? 0xFF8C00 : value.severity === 'medium' ? 0xFFFF00 : 0x00FF00,
            title: `🎫 Ticket #${ticketResult.id} - ${value.title}`,
            fields: [
                { name: '📝 Título', value: value.title, inline: true },
                { name: `${severityEmojis[value.severity]} Severidade`, value: value.severity.toUpperCase(), inline: true },
                { name: '⚡ Prioridade', value: value.priority.toUpperCase(), inline: true },
                { name: '📂 Categoria', value: value.category, inline: true },
                { name: '📄 Descrição', value: value.reason, inline: false },
                { name: '👤 Usuário', value: `<@${targetUserId}>`, inline: true },
                { name: '🔧 Criado por', value: `<@${requesterId}>`, inline: true },
                { name: '🕒 Data', value: new Date().toLocaleString('pt-PT'), inline: true }
            ],
            footer: { text: 'Sistema de Tickets YSNM' },
            timestamp: new Date()
        };
        
        const components = [
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 3,
                        label: 'Atribuir-me',
                        custom_id: `ticket_assign_${ticketResult.id}`,
                        emoji: { name: '👋' }
                    },
                    {
                        type: 2,
                        style: 4,
                        label: 'Fechar Ticket',
                        custom_id: `ticket_close_${ticketResult.id}`,
                        emoji: { name: '🔒' }
                    }
                ]
            }
        ];
        
        await ticketChannel.send({
            content: `<@${targetUserId}> ${requesterId !== targetUserId ? `Ticket criado por <@${requesterId}>` : 'O seu ticket foi criado com sucesso!'}`,
            embeds: [embed],
            components: components
        });
        
        // Log da criação (não crítico - se falhar, ticket ainda é criado)
        try {
            await db.createLog(guildId, 'ticket_created', {
                ticketId: ticketResult.id,
                title: value.title,
                severity: value.severity,
                targetUserId,
                createdBy: requesterId
            });
            addDebugLog('info', '✅ Log de criação de ticket registrado', { ticketId: ticketResult.id });
        } catch (logError) {
            addDebugLog('error', '⚠️ Erro ao criar log (não crítico)', { 
                error: logError.message, 
                ticketId: ticketResult.id,
                guildId 
            });
        }
        
        addDebugLog('info', `✅ Ticket #${ticketResult.id} criado com sucesso no canal ${ticketChannel.name}`);
        
        res.json({
            success: true,
            ticket_id: ticketResult.id,
            channel_id: ticketChannel.id,
            channel_name: ticketChannel.name,
            title: value.title,
            severity: value.severity,
            message: 'Ticket criado com sucesso'
        });
    } catch (error) {
        addDebugLog('error', '❌ Erro ao criar ticket', {
            error: error.message,
            stack: error.stack,
            requestBody: req.body,
            userInfo: req.user,
            guildId: req.currentServerId
        });
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Update ticket
router.put('/tickets/:id', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const schema = Joi.object({
            status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed').optional(),
            priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
            assigned_to: Joi.string().optional(),
            title: Joi.string().min(3).max(100).optional(),
            description: Joi.string().max(1000).optional()
        });
        
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        
        const ticketId = req.params.id;
        const success = await db.updateTicket(ticketId, value);
        
        if (!success) {
            return res.status(404).json({ error: 'Ticket não encontrado' });
        }
        
        res.json({
            success: true,
            message: 'Ticket atualizado com sucesso'
        });
    } catch (error) {
    logger.error('Erro ao atualizar ticket', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Add ticket message
router.post('/tickets/:id/messages', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const schema = Joi.object({
            message: Joi.string().min(1).max(1000).required(),
            is_internal: Joi.boolean().default(false)
        });
        
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        
        const ticketId = req.params.id;
        const userId = req.user?.id || req.session?.user?.id || '381762006329589760';
        
        const messageId = await db.addTicketMessage({
            ticket_id: ticketId,
            user_id: userId,
            message: value.message,
            is_internal: value.is_internal
        });
        
        res.json({
            success: true,
            message_id: messageId,
            message: 'Mensagem adicionada com sucesso'
        });
    } catch (error) {
    logger.error('Erro ao adicionar mensagem ao ticket', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Assign ticket to user
router.post('/tickets/:id/assign', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const ticketId = req.params.id;
        const userId = req.user.id;
        const username = req.user.username;
        
    logger.info('👋 Atribuindo ticket #%s para %s (%s)', ticketId, username, userId);
        
        // Buscar ticket na base de dados
        const tickets = await db.getTickets(req.currentServerId);
        const ticket = tickets.find(t => t.id == ticketId);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket não encontrado' });
        }
        
        // Atualizar ticket na base de dados
        await db.updateTicketStatus(ticketId, 'assigned', userId);
        
        // Notificar no Discord se bot disponível
        if (global.discordClient && global.discordClient.isReady()) {
            const guild = global.discordClient.guilds.cache.get(req.currentServerId);
            if (guild) {
                const ticketChannel = guild.channels.cache.get(ticket.channel_id);
                if (ticketChannel) {
                    const embed = {
                        color: 0xFFAA00,
                        title: '👋 Ticket Atribuído',
                        description: `Ticket foi atribuído para <@${userId}>`,
                        fields: [
                            { name: '🎫 Ticket', value: `#${ticketId}`, inline: true },
                            { name: '👤 Atribuído para', value: username, inline: true },
                            { name: '🕒 Data', value: new Date().toLocaleString('pt-PT'), inline: true }
                        ],
                        footer: { text: 'Sistema de Tickets YSNM' },
                        timestamp: new Date()
                    };
                    
                    await ticketChannel.send({ embeds: [embed] });
                    logger.info('✅ Notificação de atribuição enviada no canal %s', ticketChannel.name);
                }
            }
        }
        
        res.json({
            success: true,
            message: 'Ticket atribuído com sucesso'
        });
    } catch (error) {
    logger.error('Erro ao atribuir ticket', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Close ticket
router.post('/tickets/:id/close', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const ticketId = req.params.id;
        const { reason } = req.body;
        const userId = req.user.id;
        const username = req.user.username;
        
    logger.info('🔒 Fechando ticket #%s por %s', ticketId, username);
        
        // Buscar ticket na base de dados
        const tickets = await db.getTickets(req.currentServerId);
        const ticket = tickets.find(t => t.id == ticketId);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket não encontrado' });
        }
        
        // Atualizar ticket na base de dados
        await db.updateTicketStatus(ticketId, 'closed', null, reason || 'Resolvido');

        // Atualizar campo archived na base para que nao apareca em ativos
        try {
            await db.updateTicket(ticketId, { archived: 1 });
        } catch (err) {
            logger.warn('⚠️ Falha ao marcar ticket como arquivado no DB', { error: err && err.message ? err.message : err });
        }

        // Recarregar ticket atual para verificar flag do webhook
        const updatedTicket = await db.getTicketById(ticketId);

        // Enviar webhook de arquivo se configurado e ainda nao enviado
        try {
            const webhookConfig = await db.getGuildConfig(req.currentServerId, 'archive_webhook_url');
            if (webhookConfig?.value && !updatedTicket?.bug_webhook_sent) {
                const sent = await sendArchivedWebhookWithRetries(webhookConfig.value, updatedTicket, reason || 'Resolvido');
                if (sent) await db.markTicketWebhookSent(ticketId);
            }
        } catch (webhookErr) {
            addDebugLog('error', 'Erro ao enviar webhook ao fechar ticket', { error: webhookErr.message, ticketId });
        }

        // Emitir atualização via Socket.IO para dashboards/tickets conectados
        try {
            if (global.socketManager) {
                global.socketManager.broadcastToGuild(req.currentServerId, 'ticket_closed', { ticketId });
                global.socketManager.broadcastToGuild(req.currentServerId, 'ticket_updated', { ticket: updatedTicket });
            }
        } catch (emitErr) {
            logger.warn('⚠️ Erro ao emitir eventos via socketManager', { error: emitErr && emitErr.message ? emitErr.message : emitErr });
        }
        
        // Notificar no Discord e arquivar canal se bot disponível
        if (global.discordClient && global.discordClient.isReady()) {
            const guild = global.discordClient.guilds.cache.get(req.currentServerId);
            if (guild) {
                const ticketChannel = guild.channels.cache.get(ticket.channel_id);
                if (ticketChannel) {
                    // Enviar mensagem de fechamento
                    const embed = {
                        color: 0xFF0000,
                        title: '🔒 Ticket Fechado',
                        description: 'Este ticket foi fechado e será arquivado em 10 segundos.',
                        fields: [
                            { name: '🎫 Ticket', value: `#${ticketId}`, inline: true },
                            { name: '👤 Fechado por', value: username, inline: true },
                            { name: '📝 Motivo', value: reason || 'Resolvido', inline: true },
                            { name: '🕒 Data', value: new Date().toLocaleString('pt-PT'), inline: false }
                        ],
                        footer: { text: 'Sistema de Tickets YSNM' },
                        timestamp: new Date()
                    };
                    
                    await ticketChannel.send({ embeds: [embed] });
                    
                    // Arquivar canal após 10 segundos
                    setTimeout(async () => {
                        try {
                            // Mover para categoria de tickets arquivados
                            let archivedCategory = guild.channels.cache.find(
                                channel => channel.type === 4 && channel.name.toLowerCase() === 'tickets-arquivados'
                            );
                            
                            if (!archivedCategory) {
                                archivedCategory = await guild.channels.create({
                                    name: 'Tickets-Arquivados',
                                    type: 4, // Category
                                    permissionOverwrites: [
                                        {
                                            id: guild.roles.everyone,
                                            deny: ['ViewChannel']
                                        },
                                        // Apenas moderadores podem ver
                                        ...guild.roles.cache
                                            .filter(role => role.permissions.has('ManageMessages'))
                                            .map(role => ({
                                                id: role.id,
                                                allow: ['ViewChannel', 'ReadMessageHistory']
                                            }))
                                    ]
                                });
                            }
                            
                            // Renomear canal para indicar que está fechado
                const newName = `fechado-${ticketChannel.name}`;
                await ticketChannel.setName(newName);
                await ticketChannel.setParent(archivedCategory.id);
                            
                // Remover permissões do usuário original
                await ticketChannel.permissionOverwrites.delete(ticket.user_id);
                            
                logger.info('📁 Ticket #%s arquivado como %s', ticketId, newName);
                        } catch (archiveError) {
                logger.error('Erro ao arquivar ticket', { error: archiveError && archiveError.message ? archiveError.message : archiveError, stack: archiveError && archiveError.stack });
                        }
                    }, 10000);
                    
            logger.info('✅ Ticket #%s fechado com sucesso', ticketId);
                }
            }
        }
        
        res.json({
            success: true,
            message: 'Ticket fechado com sucesso'
        });
    } catch (error) {
        logger.error('Erro ao fechar ticket', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Endpoint para atualizar severidade do ticket
// Update ticket severity
router.put('/tickets/:id/severity', requireAuth, ensureDbReady, async (req, res) => {
    addDebugLog('info', '🎯 Endpoint /tickets/:id/severity chamado', { 
        ticketId: req.params.id, 
        method: req.method,
        body: req.body,
        user: req.user?.username,
        authenticated: req.isAuthenticated(),
        url: req.url
    });
    
    try {
        const ticketId = req.params.id;
        const { severity } = req.body;
        const username = req.user?.username || 'Unknown'; // Corrigir para req.user em vez de req.session
        
        addDebugLog('info', '🔄 Atualizando severidade do ticket', { ticketId, severity, username });
        
        // Validar severidade
        const validSeverities = ['low', 'medium', 'high', 'urgent'];
        if (!validSeverities.includes(severity)) {
            addDebugLog('error', '❌ Severidade inválida', { severity, validSeverities });
            return res.status(400).json({ error: 'Severidade inválida' });
        }
        
        const db = req.db;
        
        // Verificar se o ticket existe
        const tickets = await db.getTickets(req.currentServerId);
        const ticket = tickets.find(t => t.id == ticketId);
        
        if (!ticket) {
            addDebugLog('error', '❌ Ticket não encontrado', { ticketId, guildId: req.currentServerId });
            return res.status(404).json({ error: 'Ticket não encontrado' });
        }
        
        addDebugLog('info', '✅ Ticket encontrado, atualizando severidade', { ticket: ticket.title, oldSeverity: ticket.severity, newSeverity: severity });
        
        // Atualizar severidade
        await db.updateTicketSeverity(ticketId, severity);
        
        // Log da alteração
        await db.createLog(req.currentServerId, 'ticket_severity_updated', {
            ticketId,
            oldSeverity: ticket.severity,
            newSeverity: severity,
            updatedBy: username
        });
        
        addDebugLog('info', '✅ Severidade do ticket atualizada com sucesso', { ticketId, severity });
        
        res.json({
            success: true,
            message: 'Severidade do ticket atualizada com sucesso'
        });
    } catch (error) {
        addDebugLog('error', '❌ Erro ao atualizar severidade do ticket', {
            error: error.message,
            stack: error.stack,
            ticketId: req.params.id,
            body: req.body,
            guildId: req.currentServerId
        });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Endpoint para adicionar usuário ao ticket
router.post('/tickets/:id/users', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const ticketId = req.params.id;
        const { userId } = req.body;
        const { username } = req.session;
        
        if (!userId) {
            return res.status(400).json({ error: 'ID do usuário é obrigatório' });
        }
        
        const db = req.db;
        
        // Verificar se o ticket existe
        const tickets = await db.getTickets(req.currentServerId);
        const ticket = tickets.find(t => t.id == ticketId);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket não encontrado' });
        }
        
        // Verificar se o usuário existe no Discord
        let user = null;
        if (global.discordClient && global.discordClient.isReady()) {
            const guild = global.discordClient.guilds.cache.get(req.currentServerId);
            if (guild) {
                try {
                    const member = await guild.members.fetch(userId);
                    user = {
                        id: member.id,
                        username: member.user.username,
                        displayName: member.displayName,
                        avatar: member.user.displayAvatarURL()
                    };
                } catch (error) {
                    return res.status(404).json({ error: 'Usuário não encontrado no servidor' });
                }
            }
        }
        
        // Adicionar usuário ao ticket
        await db.addUserToTicket(ticketId, userId);
        
        // Log da adição
        await db.createLog(req.currentServerId, 'ticket_user_added', {
            ticketId,
            userId,
            addedBy: username
        });
        
        res.json({
            success: true,
            message: 'Usuário adicionado ao ticket com sucesso',
            user
        });
    } catch (error) {
        logger.error('Erro ao adicionar usuário ao ticket', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Endpoint para remover usuário do ticket
router.delete('/tickets/:id/users/:userId', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const ticketId = req.params.id;
        const userId = req.params.userId;
        const { username } = req.session;
        
        const db = req.db;
        
        // Verificar se o ticket existe
        const tickets = await db.getTickets(req.currentServerId);
        const ticket = tickets.find(t => t.id == ticketId);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket não encontrado' });
        }
        
        // Remover usuário do ticket
        await db.removeUserFromTicket(ticketId, userId);
        
        // Log da remoção
        await db.createLog(req.currentServerId, 'ticket_user_removed', {
            ticketId,
            userId,
            removedBy: username
        });
        
        res.json({
            success: true,
            message: 'Usuário removido do ticket com sucesso'
        });
    } catch (error) {
        logger.error('Erro ao remover usuário do ticket', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Endpoint para deletar ticket
router.delete('/tickets/:id', requireAuth, ensureDbReady, async (req, res) => {
    addDebugLog('info', '🗑️ Endpoint DELETE /tickets/:id chamado', { 
        ticketId: req.params.id, 
        method: req.method,
        user: req.user?.username,
        authenticated: req.isAuthenticated(),
        url: req.url
    });
    
    try {
        const ticketId = req.params.id;
        const username = req.user?.username || 'Unknown';
        
        addDebugLog('info', '🗑️ Tentando deletar ticket', { ticketId, username });
        
        // Validar se ticketId é um número
        if (isNaN(ticketId)) {
            logger.warn('❌ ID de ticket inválido: %s', ticketId);
            return res.status(400).json({ error: 'ID de ticket inválido' });
        }
        
        const db = req.db;
        
        // Verificar se o ticket existe
        const tickets = await db.getTickets(req.currentServerId);
        const ticket = tickets.find(t => t.id == ticketId);
        
    logger.info('🎫 Ticket encontrado: %s', ticket ? `ID ${ticket.id}` : 'Não encontrado');
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket não encontrado' });
        }
        
        // Deletar canal do Discord se existir
        if (global.discordClient && global.discordClient.isReady()) {
            const guild = global.discordClient.guilds.cache.get(req.currentServerId);
            if (guild && ticket.channel_id) {
                try {
                    const channel = guild.channels.cache.get(ticket.channel_id);
                    if (channel) {
                        await channel.delete('Ticket deletado via dashboard');
                    }
                } catch (error) {
                    logger.warn('Erro ao deletar canal do Discord', { error: error && error.message ? error.message : error });
                }
            }
        }
        
        // Enviar ticket para webhook de arquivo (antes de deletar)
        try {
            const webhookConfig = await db.getGuildConfig(req.currentServerId, 'archive_webhook_url');
            if (webhookConfig?.value) {
                await sendArchivedWebhookWithRetries(
                    webhookConfig.value,
                    ticket,
                    `Ticket deletado por ${username}`
                );
            }
        } catch (webhookError) {
            addDebugLog('error', '⚠️ Erro ao enviar webhook (não crítico)', { 
                error: webhookError.message, 
                ticketId 
            });
        }
        
        // Deletar ticket da base de dados
        await db.deleteTicket(ticketId);
        
        // Log da deleção
        await db.createLog(req.currentServerId, 'ticket_deleted', {
            ticketId,
            ticketTitle: ticket.title,
            deletedBy: username
        });
        
        res.json({
            success: true,
            message: 'Ticket deletado com sucesso'
        });
    } catch (error) {
        logger.error('Erro ao deletar ticket', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Endpoint para buscar usuários do Discord
router.get('/discord/users/search', requireAuth, async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query || query.length < 2) {
            return res.json({ users: [] });
        }
        
        const users = [];
        
        if (global.discordClient && global.discordClient.isReady()) {
            const guild = global.discordClient.guilds.cache.get(req.currentServerId);
            if (guild) {
                // Buscar membros que correspondam à query
                const members = guild.members.cache.filter(member => 
                    member.user.username.toLowerCase().includes(query.toLowerCase()) ||
                    member.displayName.toLowerCase().includes(query.toLowerCase()) ||
                    member.user.tag.toLowerCase().includes(query.toLowerCase())
                );
                
                // Limitar a 10 resultados
                const limitedMembers = members.first(10);
                
                limitedMembers.forEach(member => {
                    users.push({
                        id: member.id,
                        username: member.user.username,
                        displayName: member.displayName,
                        discriminator: member.user.discriminator,
                        tag: member.user.tag,
                        avatar: member.user.displayAvatarURL({ size: 32 })
                    });
                });
            }
        }
        
        res.json({ users });
    } catch (error) {
        logger.error('Erro ao buscar usuários', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// === ADMIN ROUTES ===

// Admin overview
// Test authentication endpoint
router.get('/test-auth', requireAdmin, (req, res) => {
    res.json({
        success: true,
        message: 'Autenticação funcionando!',
        user: req.user,
        timestamp: new Date().toISOString()
    });
});

router.get('/admin/overview', requireAdmin, async (req, res) => {
    try {
        const guild = req.session.guild;
        
        // Buscar estatísticas do Discord
        const stats = {
            totalMembers: guild.memberCount || 0,
            onlineMembers: guild.approximatePresenceCount || 0,
            totalChannels: guild.channels?.cache?.size || 0,
            totalRoles: guild.roles?.cache?.size || 0,
            uptime: process.uptime() ? formatUptime(process.uptime()) : '0s'
        };
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        logger.error('Erro ao buscar overview admin', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Get members
router.get('/admin/members', requireAdmin, async (req, res) => {
    try {
        const guild = req.session.guild;
        
        // Fetch members from Discord
        const members = await guild.members.fetch();
        const memberList = members.map(member => ({
            id: member.id,
            username: member.user.username,
            avatar: member.user.displayAvatarURL(),
            roles: member.roles.cache.map(role => role.name).filter(name => name !== '@everyone'),
            status: member.presence?.status || 'offline'
        }));
        
        res.json({
            success: true,
            members: memberList.slice(0, 100) // Limit to 100 for performance
        });
    } catch (error) {
        logger.error('Erro ao buscar membros', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Get channels
router.get('/admin/channels', requireAdmin, async (req, res) => {
    try {
        const guild = req.session.guild;
        
        const channels = guild.channels.cache.map(channel => ({
            id: channel.id,
            name: channel.name,
            type: channel.type,
            position: channel.position
        }));
        
        res.json({
            success: true,
            channels: channels.sort((a, b) => a.position - b.position)
        });
    } catch (error) {
        logger.error('Erro ao buscar canais', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Get roles
router.get('/admin/roles', requireAdmin, async (req, res) => {
    try {
        const guild = req.session.guild;
        
        const roles = guild.roles.cache
            .filter(role => role.name !== '@everyone')
            .map(role => ({
                id: role.id,
                name: role.name,
                color: role.hexColor,
                members: role.members.size,
                position: role.position
            }));
        
        res.json({
            success: true,
            roles: roles.sort((a, b) => b.position - a.position)
        });
    } catch (error) {
        logger.error('Erro ao buscar cargos', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Member actions
router.post('/admin/members/action', requireAdmin, async (req, res) => {
    try {
        const schema = Joi.object({
            action: Joi.string().valid('warn', 'timeout', 'kick', 'ban', 'unban', 'role').required(),
            memberId: Joi.string().required(),
            reason: Joi.string().max(500).optional(),
            duration: Joi.number().optional(),
            roleId: Joi.string().optional()
        });
        
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        
        // Get guild from session or from bot client
        let guild = req.session?.guild;
        if (!guild) {
            // Try to get guild from bot client
            const guildId = req.currentServerId || process.env.GUILD_ID || '1404259700554768406';
            if (global.discordClient && global.discordClient.isReady()) {
                guild = global.discordClient.guilds.cache.get(guildId);
                if (!guild) {
                    guild = await global.discordClient.guilds.fetch(guildId).catch(() => null);
                }
            }
        }
        
        if (!guild) {
            return res.status(500).json({ error: 'Servidor Discord não disponível ou bot não conectado' });
        }
        
        const member = await guild.members.fetch(value.memberId).catch(() => null);
        
        if (!member && value.action !== 'unban') {
            return res.status(404).json({ error: 'Membro não encontrado' });
        }
        
        let result;
        switch (value.action) {
            case 'warn':
                // Send warning DM to user
                try {
                    const user = await guild.client.users.fetch(value.memberId);
                    await user.send({
                        embeds: [{
                            title: '⚠️ Aviso do Servidor',
                            description: `Recebeste um aviso no servidor **${guild.name}**`,
                            fields: [
                                { name: 'Motivo', value: value.reason || 'Nenhum motivo especificado' },
                                { name: 'Servidor', value: guild.name, inline: true }
                            ],
                            color: 0xFFA500,
                            timestamp: new Date()
                        }]
                    });
                    result = { success: true };
                } catch (dmError) {
                    logger.warn('Não foi possível enviar DM', { error: dmError && dmError.message ? dmError.message : dmError, stack: dmError && dmError.stack });
                    result = { success: true, note: 'Aviso registrado, mas DM não pôde ser enviada' };
                }
                break;
                
            case 'timeout':
                const duration = value.duration || 10 * 60 * 1000; // 10 minutes default
                result = await member.timeout(duration, value.reason);
                break;
                
            case 'kick':
                result = await member.kick(value.reason);
                break;
                
            case 'ban':
                result = await guild.members.ban(value.memberId, { reason: value.reason });
                break;
                
            case 'unban':
                result = await guild.members.unban(value.memberId, value.reason);
                break;
                
            case 'role':
                if (value.roleId) {
                    const role = guild.roles.cache.get(value.roleId);
                    if (role) {
                        result = await member.roles.add(role, value.reason);
                    }
                }
                break;
        }
        
        // Log moderation action
        try {
            await db.createModerationAction({
                guild_id: guild.id,
                user_id: value.memberId,
                moderator_id: req.user?.id || '381762006329589760',
                action_type: value.action,
                reason: value.reason,
                duration: value.duration,
                expires_at: value.duration ? new Date(Date.now() + value.duration).toISOString() : null,
                metadata: {}
            });
        } catch (dbError) {
            logger.error('Erro ao registrar ação de moderação no banco de dados', { error: dbError && dbError.message ? dbError.message : dbError, stack: dbError && dbError.stack });
            // Continue even if logging fails
        }
        
        res.json({
            success: true,
            message: `Ação ${value.action} executada com sucesso`
        });
    } catch (error) {
        logger.error('Erro ao executar ação de membro', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Create channel
router.post('/admin/channels', requireAdmin, async (req, res) => {
    try {
        const schema = Joi.object({
            name: Joi.string().min(1).max(100).required(),
            type: Joi.string().valid('GUILD_TEXT', 'GUILD_VOICE', 'GUILD_CATEGORY').required(),
            category: Joi.string().optional(),
            description: Joi.string().max(1024).optional()
        });
        
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        
        const guild = req.session.guild;
        
        const channelOptions = {
            name: value.name,
            type: value.type
        };
        
        if (value.category) {
            channelOptions.parent = value.category;
        }
        
        if (value.description && value.type === 'GUILD_TEXT') {
            channelOptions.topic = value.description;
        }
        
        const channel = await guild.channels.create(channelOptions);
        
        res.json({
            success: true,
            channel_id: channel.id,
            message: 'Canal criado com sucesso'
        });
    } catch (error) {
        logger.error('Erro ao criar canal', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Audit log helper for admin actions
async function auditAdminAction(guildId, type, message, details = {}, actor = null) {
    try {
        const payload = { message, details, actor };
        await db.createLog(guildId, type, payload);
    } catch (err) {
        logger.warn('Falha ao registrar log de admin', { error: err && err.message ? err.message : err });
    }
}

// Update channel (rename, move category, change topic)
router.patch('/admin/channels/:channelId', requireAdmin, async (req, res) => {
    try {
        const channelId = req.params.channelId;
        const { name, category, description } = req.body || {};

        let guild = req.session.guild;
        // Try to resolve to a real Guild object if session holds a minimal object
        if (guild && (!guild.channels || !guild.channels.cache)) {
            if (global.discordClient && global.discordClient.isReady()) {
                guild = await global.discordClient.guilds.fetch(guild.id).catch(() => null);
            }
        }

        if (!guild || !guild.channels) return res.status(503).json({ error: 'Guild object not available on server' });

        const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
        if (!channel) return res.status(404).json({ error: 'Channel not found' });

        const opts = {};
        if (name) opts.name = name;
        if (typeof description !== 'undefined' && channel.type === 0) opts.topic = description;
        if (category) opts.parent = category;

        // Apply edits
        await channel.edit(opts);

    // Audit
    await auditAdminAction(guild.id || guild, 'channel_updated', `Channel ${channelId} updated`, { changes: opts }, req.user?.id || null);

        res.json({ success: true, message: 'Canal atualizado com sucesso' });
    } catch (error) {
        logger.error('Erro ao atualizar canal', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Delete channel
router.delete('/admin/channels/:channelId', requireAdmin, async (req, res) => {
    try {
        const channelId = req.params.channelId;

        let guild = req.session.guild;
        if (guild && (!guild.channels || !guild.channels.cache)) {
            if (global.discordClient && global.discordClient.isReady()) {
                guild = await global.discordClient.guilds.fetch(guild.id).catch(() => null);
            }
        }

        if (!guild || !guild.channels) return res.status(503).json({ error: 'Guild object not available on server' });

        const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
        if (!channel) return res.status(404).json({ error: 'Channel not found' });

        // Safety checks: ensure bot can delete and channel is deletable
        const botMember = guild.members?.me || (global.discordClient ? guild.members.cache.get(global.discordClient.user.id) : null);
        if (!botMember) return res.status(503).json({ error: 'Bot member not available to perform deletion' });

        // If channel has children (category), require explicit force flag
        const isCategory = channel.type === 4 || channel.type === 'GUILD_CATEGORY';
        if (isCategory) {
            const children = guild.channels.cache.filter(c => c.parentId === channel.id || c.parent === channel.id);
            if (children && children.size > 0 && !req.body?.force) {
                return res.status(400).json({ error: 'Category has child channels; provide { force: true } to delete anyway', children: children.map(c=>({ id: c.id, name: c.name })) });
            }
        }

        // Check permissions
        try {
            if (typeof channel.deletable !== 'undefined' && channel.deletable === false) {
                return res.status(403).json({ error: 'Bot cannot delete this channel due to permissions' });
            }
            // Also check botMember permissions
            const canManage = botMember.permissions?.has ? botMember.permissions.has('ManageChannels') : true;
            if (!canManage) return res.status(403).json({ error: 'Bot lacks ManageChannels permission' });
        } catch (permErr) {
            // Continue cautiously
        }

        await channel.delete();

    await auditAdminAction(guild.id || guild, 'channel_deleted', `Channel ${channelId} deleted`, { channelId }, req.user?.id || null);

    res.json({ success: true, message: 'Canal removido com sucesso' });
    } catch (error) {
        logger.error('Erro ao deletar canal', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Create role
router.post('/admin/roles', requireAdmin, async (req, res) => {
    try {
        const schema = Joi.object({
            name: Joi.string().min(1).max(100).required(),
            color: Joi.string().regex(/^#[0-9A-F]{6}$/i).optional(),
            permissions: Joi.array().items(Joi.string()).optional()
        });
        
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        
        const guild = req.session.guild;
        
        const roleOptions = {
            name: value.name
        };
        
        if (value.color) {
            roleOptions.color = value.color;
        }
        
        if (value.permissions) {
            roleOptions.permissions = value.permissions;
        }
        
        const role = await guild.roles.create(roleOptions);

        // Audit create
        await auditAdminAction(guild.id || guild, 'role_created', `Role created ${role.id}`, { role: { id: role.id, name: role.name } }, req.user?.id || null);

        res.json({
            success: true,
            role_id: role.id,
            message: 'Cargo criado com sucesso'
        });
    } catch (error) {
        logger.error('Erro ao criar cargo', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

    // Update role (rename, color, hoist, mentionable)
    router.patch('/admin/roles/:roleId', requireAdmin, async (req, res) => {
        try {
            const roleId = req.params.roleId;
            const { name, color, hoist, mentionable } = req.body || {};

            let guild = req.session.guild;
            if (guild && (!guild.roles || !guild.roles.cache)) {
                if (global.discordClient && global.discordClient.isReady()) {
                    guild = await global.discordClient.guilds.fetch(guild.id).catch(() => null);
                }
            }

            if (!guild || !guild.roles) return res.status(503).json({ error: 'Guild object not available on server' });

            const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
            if (!role) return res.status(404).json({ error: 'Role not found' });

            const opts = {};
            if (name) opts.name = name;
            if (color) opts.color = color;
            if (typeof hoist !== 'undefined') opts.hoist = !!hoist;
            if (typeof mentionable !== 'undefined') opts.mentionable = !!mentionable;

            await role.edit(opts);

    await auditAdminAction(guild.id || guild, 'role_updated', `Role ${roleId} updated`, { changes: opts }, req.user?.id || null);

            res.json({ success: true, message: 'Cargo atualizado com sucesso' });
        } catch (error) {
            logger.error('Erro ao atualizar cargo', { error: error && error.message ? error.message : error, stack: error && error.stack });
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    });

    // Delete role
    router.delete('/admin/roles/:roleId', requireAdmin, async (req, res) => {
        try {
            const roleId = req.params.roleId;

            let guild = req.session.guild;
            if (guild && (!guild.roles || !guild.roles.cache)) {
                if (global.discordClient && global.discordClient.isReady()) {
                    guild = await global.discordClient.guilds.fetch(guild.id).catch(() => null);
                }
            }

            if (!guild || !guild.roles) return res.status(503).json({ error: 'Guild object not available on server' });

            const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
            if (!role) return res.status(404).json({ error: 'Role not found' });

            // Protect @everyone
            if (role.id === guild.id) return res.status(400).json({ error: 'Cannot delete @everyone role' });

            // Protect managed roles (integration/system)
            if (role.managed) return res.status(400).json({ error: 'Cannot delete managed role' });

            // Prevent deleting roles higher or equal to bot's highest role
            const botMember = guild.members?.me || (global.discordClient ? guild.members.cache.get(global.discordClient.user.id) : null);
            if (!botMember) return res.status(503).json({ error: 'Bot member not available to perform deletion' });

            const botHighest = botMember.roles?.highest?.position || 0;
            if (role.position >= botHighest) return res.status(403).json({ error: 'Cannot delete role with equal/higher position than bot' });

            // Require force if role has many members
            const memberCount = role.members ? role.members.size : 0;
            if (memberCount > 10 && !req.body?.force) {
                return res.status(400).json({ error: 'Role has members; provide { force: true } to delete and remove role from members', memberCount });
            }

            await role.delete();

    await auditAdminAction(guild.id || guild, 'role_deleted', `Role ${roleId} deleted`, { roleId }, req.user?.id || null);

            res.json({ success: true, message: 'Cargo removido com sucesso' });
        } catch (error) {
            logger.error('Erro ao deletar cargo', { error: error && error.message ? error.message : error, stack: error && error.stack });
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    });

// Get logs
router.get('/admin/logs', requireAdmin, ensureDbReady, async (req, res) => {
    try {
        const { type, level } = req.query;
        const guildId = req.query.guildId || (req.session && req.session.guild && req.session.guild.id) || req.currentServerId || process.env.GUILD_ID;

    const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
    const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
    const offset = (page - 1) * limit;

        addDebugLog('debug', 'Fetching admin logs', { guildId, type, level, limit });

        // Defensive checks: ensure req.db exists
        if (!req.db) {
            logger.error('Req.db not available when fetching admin logs', { guildId, query: req.query });
            addDebugLog('error', 'req.db missing when fetching admin logs', { guildId });
            return res.status(500).json({ error: 'Database não disponível' });
        }

    const options = { guild_id: guildId, type: type || null, level: level || null, limit, offset };
        addDebugLog('debug', 'getLogs options', options);

    let logs;
        try {
            logs = await req.db.getLogs(options);
            addDebugLog('debug', 'getLogs result', { count: Array.isArray(logs) ? logs.length : 0 });
        } catch (dbErr) {
            logger.error('Erro ao executar req.db.getLogs', { error: dbErr && dbErr.message ? dbErr.message : dbErr, stack: dbErr && dbErr.stack });
            addDebugLog('error', 'Erro ao executar getLogs', { error: dbErr && dbErr.message ? dbErr.message : dbErr });
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }

        // Also return total count for pagination
        try {
            const total = await req.db.getLogsCount({ guild_id: guildId, type: type || null, level: level || null });
            res.json({ success: true, logs, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
        } catch (countErr) {
            addDebugLog('warn', 'Failed to compute logs total', { error: countErr && countErr.message ? countErr.message : countErr });
            res.json({ success: true, logs, pagination: { page, limit } });
        }
    } catch (error) {
        logger.error('Erro ao buscar logs', { error: error && error.message ? error.message : error, stack: error && error.stack });
        addDebugLog('error', 'Erro ao buscar logs (stack)', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Save settings
router.post('/admin/settings', requireAdmin, async (req, res) => {
    try {
        const guildId = req.session.guild.id;
        
        for (const [key, value] of Object.entries(req.body)) {
            await db.updateGuildSetting(guildId, key, value);
        }
        
        res.json({
            success: true,
            message: 'Configurações salvas com sucesso'
        });
    } catch (error) {
        logger.error('Erro ao salvar configurações', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Lock/unlock server
router.post('/admin/server/lock', requireAdmin, async (req, res) => {
    try {
        const guild = req.session.guild;
        const everyoneRole = guild.roles.everyone;
        
        await everyoneRole.setPermissions(
            everyoneRole.permissions.remove(['SEND_MESSAGES', 'ADD_REACTIONS'])
        );
        
        res.json({
            success: true,
            message: 'Servidor trancado com sucesso'
        });
    } catch (error) {
        logger.error('Erro ao trancar servidor', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/admin/server/unlock', requireAdmin, async (req, res) => {
    try {
        const guild = req.session.guild;
        const everyoneRole = guild.roles.everyone;
        
        await everyoneRole.setPermissions(
            everyoneRole.permissions.add(['SEND_MESSAGES', 'ADD_REACTIONS'])
        );
        
        res.json({
            success: true,
            message: 'Servidor destrancado com sucesso'
        });
    } catch (error) {
        logger.error('Erro ao destrancar servidor', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Helper function
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    return parts.join(' ') || '0m';
}

// Configuração de webhook para tickets arquivados
router.get('/config/archive-webhook', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const db = req.db;
        const guildId = req.currentServerId;
        
        // Buscar configuração atual do webhook
        const config = await db.getGuildConfig(guildId, 'archive_webhook_url');
        
        res.json({
            success: true,
            webhookUrl: config?.value || null
        });
    } catch (error) {
        addDebugLog('error', '❌ Erro ao buscar config de webhook', { error: error.message });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/config/archive-webhook', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const { webhookUrl } = req.body;
        const db = req.db;
        const guildId = req.currentServerId;
        
        // Validar URL do webhook
        if (webhookUrl && !webhookUrl.includes('discord.com/api/webhooks/')) {
            return res.status(400).json({ error: 'URL de webhook inválida' });
        }
        
        // Salvar configuração
        await db.setGuildConfig(guildId, 'archive_webhook_url', webhookUrl);
        
        addDebugLog('info', '✅ Webhook de arquivo configurado', { guildId, hasWebhook: !!webhookUrl });
        
        res.json({
            success: true,
            message: webhookUrl ? 'Webhook configurado com sucesso' : 'Webhook removido com sucesso'
        });
    } catch (error) {
        addDebugLog('error', '❌ Erro ao configurar webhook', { error: error.message });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Endpoint para testar webhook
router.post('/config/archive-webhook/test', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const db = req.db;
        const guildId = req.currentServerId;
        
        // Buscar URL do webhook
        const config = await db.getGuildConfig(guildId, 'archive_webhook_url');
        if (!config?.value) {
            return res.status(400).json({ error: 'Webhook não configurado' });
        }
        
        // Dados de teste
        const testTicket = {
            id: 999,
            title: 'Ticket de Teste',
            description: 'Este é um ticket de teste para verificar o webhook',
            user_id: req.user.id,
            severity: 'medium',
            category: 'teste',
            created_at: new Date().toISOString()
        };
        
        // Enviar teste
    let success = false;
    try {
        success = await sendArchivedWebhookWithRetries(config.value, testTicket, 'Teste de webhook');
    } catch (e) {
        success = false;
    }

    if (success) {
        return res.json({ success: true, message: 'Webhook testado com sucesso' });
    }

    // If webhookSender failed, try to resolve webhook via discord client and post to its channel
    try {
        if (global.discordClient && global.discordClient.isReady && global.discordClient.isReady()) {
            // Try to fetch webhook by parsing id from URL
            const match = (config.value || '').match(/webhooks\/(\d+)\//);
            const webhookId = match ? match[1] : null;
            if (webhookId) {
                try {
                    const wh = await global.discordClient.fetchWebhook(webhookId).catch(() => null);
                    if (wh && wh.channelId) {
                        const channel = await global.discordClient.channels.fetch(wh.channelId).catch(() => null);
                        if (channel && channel.send) {
                            await channel.send(`🔔 Teste de webhook: envio de teste falhou via webhook, mas enviando via bot para canal <#${wh.channelId}>`);
                            return res.json({ success: true, message: 'Falha no webhook direta; mensagem enviada via bot para canal associado' });
                        }
                    }
                } catch (e) {
                    // ignore
                }
            }
        }
    } catch (e) {
        // ignore
    }

    res.status(500).json({ error: 'Falha ao enviar webhook de teste e fallback falhou' });
    } catch (error) {
        addDebugLog('error', '❌ Erro ao testar webhook', { error: error.message });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Debug logs endpoint
router.get('/debug-logs', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const level = req.query.level;
        
        let logs = debugLogs.slice(-limit);
        
        if (level) {
            logs = logs.filter(log => log.level === level);
        }
        
        res.json({
            total: debugLogs.length,
            showing: logs.length,
            logs: logs.reverse() // Mais recentes primeiro
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Erro ao obter logs',
            details: error.message 
        });
    }
});

// Simple test endpoint
router.get('/test', (req, res) => {
    res.json({ 
        message: 'API funcionando',
        timestamp: new Date().toISOString(),
        logsCount: debugLogs.length
    });
});

// Test endpoint with auth
router.get('/test-auth', requireAuth, (req, res) => {
    res.json({ 
        message: 'Auth funcionando',
        timestamp: new Date().toISOString(),
        user: req.user?.username || 'Unknown',
        authenticated: req.isAuthenticated()
    });
});

// Test ticket endpoint
router.put('/test-tickets/:id/severity', requireAuth, ensureDbReady, async (req, res) => {
    addDebugLog('info', '🧪 Test endpoint chamado', { 
        ticketId: req.params.id, 
        body: req.body,
        user: req.user?.username,
        authenticated: req.isAuthenticated()
    });
    res.json({ success: true, message: 'Test endpoint funcionando' });
});

// Diagnostic endpoint
router.get('/diagnostic', async (req, res) => {
    try {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            database: {
                initialized: dbInitialized,
                connected: !!(db && db.db)
            },
            discord: {
                clientAvailable: !!global.discordClient,
                clientReady: !!(global.discordClient && global.discordClient.isReady()),
                guilds: global.discordClient ? global.discordClient.guilds.cache.size : 0,
                users: global.discordClient ? global.discordClient.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0) : 0
            },
            system: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version
            }
        };

        res.json(diagnostics);
    } catch (error) {
        logger.error('❌ Erro no diagnóstico', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ 
            error: 'Erro no diagnóstico',
            details: error.message 
        });
    }
});

    return router;
};
