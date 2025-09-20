const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
require('dotenv').config();

const config = require('../utils/config');
const logger = require('../utils/logger');
const { PermissionFlagsBits } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 4000;

// Helper function for OAuth callback URL
const getCallbackURL = () => {
    if (process.env.CALLBACK_URL) {
        return process.env.CALLBACK_URL;
    }
    
    // Auto-detect based on environment  
    const baseUrl = process.env.NODE_ENV === 'production' 
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'ignisbot-alberto.up.railway.app'}`
        : `http://localhost:${PORT}`;
    
    return `${baseUrl}/auth/discord/callback`;
};

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'ignis-dashboard-development-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Always false for development/localhost
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        httpOnly: true
    }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// Discord OAuth Strategy
passport.use(new DiscordStrategy({
    clientID: config.DISCORD.CLIENT_ID,
    clientSecret: config.DISCORD.CLIENT_SECRET,
    callbackURL: getCallbackURL(),
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    profile.accessToken = accessToken;
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    logger.info(`Serializing user: ${user.username} (${user.id})`);
    done(null, user);
});

passport.deserializeUser((user, done) => {
    logger.info(`Deserializing user: ${user.username} (${user.id})`);
    done(null, user);
});

// Routes
app.get('/', (req, res) => {
    logger.info(`Route / - isAuthenticated: ${req.isAuthenticated()}, sessionID: ${req.sessionID}`);
    if (req.isAuthenticated()) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

app.get('/login', (req, res) => {
    logger.info(`Route /login - isAuthenticated: ${req.isAuthenticated()}, sessionID: ${req.sessionID}`);
    if (req.isAuthenticated()) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

app.get('/dashboard', (req, res) => {
    logger.info(`Route /dashboard - isAuthenticated: ${req.isAuthenticated()}, user: ${req.user ? req.user.username : 'none'}, sessionID: ${req.sessionID}`);
    if (!req.isAuthenticated()) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Auth routes
app.get('/auth/discord', passport.authenticate('discord'));

// Debug endpoint para verificar configuração OAuth
app.get('/auth/debug', (req, res) => {
    res.json({
        clientID: config.DISCORD.CLIENT_ID,
        callbackURL: getCallbackURL(),
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        railwayDomain: process.env.RAILWAY_PUBLIC_DOMAIN,
        hasClientSecret: !!config.DISCORD.CLIENT_SECRET
    });
});

// Debug endpoint para verificar sessão
app.get('/debug/session', (req, res) => {
    res.json({
        isAuthenticated: req.isAuthenticated(),
        sessionID: req.sessionID,
        user: req.user || null,
        session: req.session,
        cookies: req.headers.cookie
    });
});

app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/login' }),
    (req, res) => {
        logger.info(`OAuth callback success - user: ${req.user ? req.user.username : 'none'}, sessionID: ${req.sessionID}`);
        logger.info(`Session data:`, req.session);
        res.redirect('/dashboard');
    }
);

app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) logger.error('Logout error:', err);
        res.redirect('/');
    });
});

// API Routes
app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    res.json({
        success: true,
        user: {
            id: req.user.id,
            username: req.user.username,
            discriminator: req.user.discriminator,
            avatar: req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` : null
        }
    });
});

app.get('/api/guilds', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    try {
        // Get user guilds from Discord API using access token
        const fetch = require('node-fetch');
        const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
            headers: {
                'Authorization': `Bearer ${req.user.accessToken}`
            }
        });
        
        const userGuilds = await response.json();
        
        // Get bot's guilds
        const client = global.discordClient;
        if (!client) {
            return res.json({ success: true, guilds: [] });
        }
        
        const botGuilds = client.guilds.cache;
        
        // Filter guilds where user has admin permissions and bot is present
        const managedGuilds = userGuilds.filter(guild => {
            const hasAdmin = (guild.permissions & 0x8) === 0x8; // Administrator permission
            const botPresent = botGuilds.has(guild.id);
            return hasAdmin && botPresent;
        }).map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            memberCount: botGuilds.get(guild.id)?.memberCount || 0,
            botPresent: true
        }));
        
        res.json({
            success: true,
            guilds: managedGuilds
        });
        
    } catch (error) {
        logger.error('Error fetching guilds:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch guilds' });
    }
});

app.get('/api/guild/:guildId/stats', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    try {
        const guildId = req.params.guildId;
        const client = global.discordClient;
        
        if (!client) {
            return res.status(500).json({ success: false, error: 'Bot not available' });
        }
        
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }
        
        const stats = {
            memberCount: guild.memberCount,
            channelCount: guild.channels.cache.size,
            roleCount: guild.roles.cache.size,
            boosterCount: guild.premiumSubscriptionCount || 0,
            onlineCount: guild.members.cache.filter(member => 
                member.presence?.status === 'online' || 
                member.presence?.status === 'idle' || 
                member.presence?.status === 'dnd'
            ).size
        };
        
        res.json({ success: true, stats });
        
    } catch (error) {
        logger.error('Error fetching guild stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

app.get('/api/guild/:guildId/tickets', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    try {
        const guildId = req.params.guildId;
        const client = global.discordClient;
        
        if (!client) {
            return res.status(500).json({ success: false, error: 'Bot not available' });
        }

        // Verificar se o usuário tem permissões no servidor
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

    // Usar storage JSON simples
    const storage = require('../utils/storage');
    const guildTickets = await storage.getTickets(guildId);
        
        // Enriquecer dados dos tickets com informações do Discord
        const enrichedTickets = await Promise.all(guildTickets.map(async (ticket) => {
            try {
                const channel = guild.channels.cache.get(ticket.channel_id);
                const owner = await client.users.fetch(ticket.user_id).catch(() => null);
                const claimedBy = ticket.assigned_to ? await client.users.fetch(ticket.assigned_to).catch(() => null) : null;
                
                return {
                    ...ticket,
                    channelExists: !!channel,
                    channelName: channel?.name || 'Canal deletado',
                    ownerTag: owner ? `${owner.username}#${owner.discriminator}` : 'Usuário desconhecido',
                    ownerAvatar: owner?.displayAvatarURL({ size: 32 }) || null,
                    claimedByTag: claimedBy ? `${claimedBy.username}#${claimedBy.discriminator}` : null,
                    claimedByAvatar: claimedBy?.displayAvatarURL({ size: 32 }) || null,
                    timeAgo: formatTimeAgo(new Date(ticket.created_at))
                };
            } catch (error) {
                logger.error(`Erro ao enriquecer ticket ${ticket.id}:`, error);
                return {
                    ...ticket,
                    channelExists: false,
                    channelName: 'Erro ao carregar',
                    ownerTag: 'Erro ao carregar',
                    ownerAvatar: null,
                    claimedByTag: null,
                    claimedByAvatar: null,
                    timeAgo: formatTimeAgo(new Date(ticket.created_at))
                };
            }
        }));
        
        // Estatísticas dos tickets
        const stats = {
            total: guildTickets.length,
            open: guildTickets.filter(t => t.status === 'open').length,
            claimed: guildTickets.filter(t => t.status === 'claimed').length,
            closed: guildTickets.filter(t => t.status === 'closed').length,
            pending: guildTickets.filter(t => t.status === 'pending').length
        };
        
        res.json({ 
            success: true, 
            tickets: enrichedTickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
            stats 
        });
        
    } catch (error) {
        logger.error('Error fetching tickets:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch tickets' });
    }
});

// Painéis de Tickets - Listar e gerir
app.get('/api/guild/:guildId/panels', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    try {
        const guildId = req.params.guildId;
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ success: false, error: 'Guild not found' });

        // Garantir membro no servidor
        const member = await guild.members.fetch(req.user.id).catch(() => null);
        if (!member) return res.status(403).json({ success: false, error: 'You are not a member of this server' });

        // Buscar paineis do Mongo se disponível
        let panels = [];
        try {
            if (process.env.MONGO_URI || process.env.MONGODB_URI) {
                const { PanelModel } = require('../utils/db/models');
                panels = await PanelModel.find({ guild_id: guildId, type: 'tickets' }).lean();
            } else {
                panels = [];
            }
        } catch (e) {
            panels = [];
        }

        // Enriquecer com dados de canal/mensagem
        const enriched = await Promise.all((panels || []).map(async p => {
            let channelName = 'Desconhecido';
            let channelExists = false;
            let messageExists = false;
            try {
                const channel = guild.channels.cache.get(p.channel_id) || await client.channels.fetch(p.channel_id).catch(() => null);
                if (channel) {
                    channelExists = true;
                    channelName = channel.name || channel.id;
                    if (channel.messages?.fetch && p.message_id) {
                        const msg = await channel.messages.fetch(p.message_id).catch(() => null);
                        messageExists = !!msg;
                    }
                }
            } catch {}
            return { ...p, channelName, channelExists, messageExists };
        }));

        res.json({ success: true, panels: enriched });
    } catch (error) {
        logger.error('Error fetching panels:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch panels' });
    }
});

app.post('/api/guild/:guildId/panels/:panelId/action', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    try {
        const { guildId, panelId } = req.params;
        const { action, data } = req.body || {};
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ success: false, error: 'Guild not found' });

        const member = await guild.members.fetch(req.user.id).catch(() => null);
        if (!member) return res.status(403).json({ success: false, error: 'You are not a member of this server' });

        let PanelModel;
        try {
            if (process.env.MONGO_URI || process.env.MONGODB_URI) {
                PanelModel = require('../utils/db/models').PanelModel;
            } else {
                return res.status(500).json({ success: false, error: 'Panels storage not available' });
            }
        } catch {
            return res.status(500).json({ success: false, error: 'Panels storage not available' });
        }

        const panel = await PanelModel.findById(panelId).lean();
        if (!panel || `${panel.guild_id}` !== `${guildId}`) {
            return res.status(404).json({ success: false, error: 'Panel not found' });
        }

        const channel = guild.channels.cache.get(panel.channel_id) || await client.channels.fetch(panel.channel_id).catch(() => null);
        if (!channel || !channel.send) {
            return res.status(404).json({ success: false, error: 'Channel not found' });
        }

        let message;
        let updated = null;
        switch (action) {
            case 'resend': {
                // Reenviar usando payload guardado, sem apagar o anterior
                const payload = panel.payload || { content: '🎫 Painel de tickets' };
                message = await channel.send(payload);
                updated = await PanelModel.findByIdAndUpdate(panelId, { $set: { message_id: message.id } }, { new: true }).lean();
                return res.json({ success: true, message: 'Panel resent', panel: updated });
            }
            case 'recreate': {
                // Tenta eliminar mensagem antiga e enviar de novo
                if (panel.message_id && channel.messages?.fetch) {
                    const old = await channel.messages.fetch(panel.message_id).catch(() => null);
                    if (old) await old.delete().catch(() => {});
                }
                const payload = panel.payload || { content: '🎫 Painel de tickets' };
                message = await channel.send(payload);
                updated = await PanelModel.findByIdAndUpdate(panelId, { $set: { message_id: message.id } }, { new: true }).lean();
                return res.json({ success: true, message: 'Panel recreated', panel: updated });
            }
            case 'delete': {
                // Remover registo e tentar apagar mensagem
                if (panel.message_id && channel.messages?.fetch) {
                    const old = await channel.messages.fetch(panel.message_id).catch(() => null);
                    if (old) await old.delete().catch(() => {});
                }
                await PanelModel.findByIdAndDelete(panelId);
                return res.json({ success: true, message: 'Panel deleted' });
            }
            case 'theme': {
                const newTheme = (data?.theme === 'light') ? 'light' : 'dark';
                await PanelModel.findByIdAndUpdate(panelId, { $set: { theme: newTheme } });
                return res.json({ success: true, message: 'Theme updated', theme: newTheme });
            }
            default:
                return res.status(400).json({ success: false, error: 'Invalid action' });
        }
    } catch (error) {
        logger.error('Error performing panel action:', error);
        res.status(500).json({ success: false, error: 'Failed to perform panel action' });
    }
});

// Helper to ensure admin in guild
async function ensureGuildAdmin(client, guildId, userId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return { ok: false, code: 404, error: 'Guild not found' };
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return { ok: false, code: 403, error: 'You are not a member of this server' };
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin) return { ok: false, code: 403, error: 'Administrator permission required' };
    return { ok: true, guild, member };
}

// Channels list (for UIs)
app.get('/api/guild/:guildId/channels', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const channels = check.guild.channels.cache
            .filter(c => c.type === 0) // text
            .map(c => ({ id: c.id, name: c.name }))
            .sort((a,b) => a.name.localeCompare(b.name));
        res.json({ success: true, channels });
    } catch (e) {
        logger.error('Error listing channels:', e);
        res.status(500).json({ success: false, error: 'Failed to list channels' });
    }
});

// Roles list (for UIs)
app.get('/api/guild/:guildId/roles', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const roles = check.guild.roles.cache
            .filter(r => r.editable || r.managed || r.permissions.bitfield)
            .map(r => ({ id: r.id, name: r.name }))
            .sort((a,b) => a.name.localeCompare(b.name));
        res.json({ success: true, roles });
    } catch (e) {
        logger.error('Error listing roles:', e);
        res.status(500).json({ success: false, error: 'Failed to list roles' });
    }
});

// Guild Config API (advanced configs)
app.get('/api/guild/:guildId/config', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const storage = require('../utils/storage');
        const cfg = await storage.getGuildConfig(req.params.guildId);
        res.json({ success: true, config: cfg || {} });
    } catch (e) {
        logger.error('Error fetching guild config:', e);
        res.status(500).json({ success: false, error: 'Failed to fetch config' });
    }
});

app.post('/api/guild/:guildId/config', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const updates = req.body || {};
        const storage = require('../utils/storage');
        await storage.updateGuildConfig(req.params.guildId, updates);
        res.json({ success: true, message: 'Config updated' });
    } catch (e) {
        logger.error('Error updating guild config:', e);
        res.status(500).json({ success: false, error: 'Failed to update config' });
    }
});

// Webhooks API
app.get('/api/guild/:guildId/webhooks', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        if (!(process.env.MONGO_URI || process.env.MONGODB_URI)) return res.json({ success: true, webhooks: [] });
        const { WebhookModel } = require('../utils/db/models');
        const list = await WebhookModel.find({ guild_id: req.params.guildId }).lean();
        res.json({ success: true, webhooks: list });
    } catch (e) {
        logger.error('Error listing webhooks:', e);
        res.status(500).json({ success: false, error: 'Failed to list webhooks' });
    }
});

app.post('/api/guild/:guildId/webhooks', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        if (!(process.env.MONGO_URI || process.env.MONGODB_URI)) return res.status(500).json({ success: false, error: 'Mongo not available' });
        const { WebhookModel } = require('../utils/db/models');
        const { type = 'logs', name = 'Logs', url, channel_id, channel_name } = req.body || {};
        if (!url || !url.startsWith('https://discord.com/api/webhooks/')) return res.status(400).json({ success: false, error: 'Invalid webhook URL' });
        const saved = await WebhookModel.findOneAndUpdate(
            { guild_id: req.params.guildId, type },
            { $set: { name, url, channel_id, channel_name, enabled: true } },
            { upsert: true, new: true }
        ).lean();
        res.json({ success: true, webhook: saved });
    } catch (e) {
        logger.error('Error upserting webhook:', e);
        res.status(500).json({ success: false, error: 'Failed to upsert webhook' });
    }
});

app.delete('/api/guild/:guildId/webhooks/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        if (!(process.env.MONGO_URI || process.env.MONGODB_URI)) return res.status(500).json({ success: false, error: 'Mongo not available' });
        const { WebhookModel } = require('../utils/db/models');
        const result = await WebhookModel.deleteOne({ _id: req.params.id, guild_id: req.params.guildId });
        res.json({ success: true, deleted: result.deletedCount });
    } catch (e) {
        logger.error('Error deleting webhook:', e);
        res.status(500).json({ success: false, error: 'Failed to delete webhook' });
    }
});

// Auto-setup a logs webhook using bot capabilities
app.post('/api/guild/:guildId/webhooks/auto-setup', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const guild = check.guild;
        const wm = client.webhooks;
        const ok = await wm.setupForGuild(guild);
        if (!ok) return res.status(500).json({ success: false, error: 'Failed to setup webhook' });
        // Persist to Mongo if available (best effort)
        try {
            if (process.env.MONGO_URI || process.env.MONGODB_URI) {
                const { WebhookModel } = require('../utils/db/models');
                const info = wm.webhooks.get(req.params.guildId);
                const url = info?.webhook?.url;
                const name = info?.name || guild.name;
                // Try to find a likely channel used for webhook creation for better metadata
                let channel_id = null, channel_name = null;
                try {
                    // Heuristic: prefer a #logs-like text channel where bot can manage webhooks
                    const candidate = guild.channels.cache.find(c => c.type === 0 && /log|ticket|arquivo/i.test(c.name) && c.permissionsFor(guild.members.me)?.has(['ManageWebhooks','SendMessages']))
                        || guild.systemChannel
                        || guild.channels.cache.find(c => c.type === 0);
                    if (candidate) { channel_id = candidate.id; channel_name = candidate.name || null; }
                } catch {}
                if (url) {
                    await WebhookModel.findOneAndUpdate(
                        { guild_id: req.params.guildId, type: 'logs' },
                        { $set: { name, url, channel_id, channel_name, enabled: true } },
                        { upsert: true }
                    );
                }
            }
        } catch (e) {
            logger.warn('Failed to persist auto-setup webhook to Mongo:', e.message);
        }
        res.json({ success: true, message: 'Webhook configured' });
    } catch (e) {
        logger.error('Error auto-setup webhook:', e);
        res.status(500).json({ success: false, error: 'Failed to auto-setup webhook' });
    }
});

// Create a panel directly from dashboard
app.post('/api/guild/:guildId/panels/create', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const { channel_id, theme = 'dark' } = req.body || {};
        if (!channel_id) return res.status(400).json({ success: false, error: 'Missing channel_id' });
        const guild = check.guild;
        const channel = guild.channels.cache.get(channel_id) || await client.channels.fetch(channel_id).catch(() => null);
        if (!channel || !channel.send) return res.status(404).json({ success: false, error: 'Channel not found' });
        // Build payload like slash command
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setColor(theme === 'light' ? 0x60A5FA : 0x7C3AED)
            .setTitle('🎫 Centro de Suporte')
            .setDescription('Escolhe o departamento abaixo para abrir um ticket privado com a equipa.\n\n• Resposta rápida • Canal privado • Histórico guardado');
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket:create:technical').setLabel('Suporte Técnico').setEmoji('🔧').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ticket:create:incident').setLabel('Reportar Problema').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('ticket:create:moderation').setLabel('Moderação & Segurança').setEmoji('🛡️').setStyle(ButtonStyle.Secondary)
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket:create:general').setLabel('Dúvidas Gerais').setEmoji('💬').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket:create:account').setLabel('Suporte de Conta').setEmoji('🧾').setStyle(ButtonStyle.Secondary)
        );
        const payload = { embeds: [embed], components: [row1, row2] };
        const msg = await channel.send(payload);
        // Persist PanelModel if mongo available
        try {
            if (process.env.MONGO_URI || process.env.MONGODB_URI) {
                const { PanelModel } = require('../utils/db/models');
                await PanelModel.findOneAndUpdate(
                    { guild_id: req.params.guildId, channel_id, type: 'tickets' },
                    { $set: { message_id: msg.id, theme, payload } },
                    { upsert: true }
                );
            }
        } catch {}
        res.json({ success: true, message: 'Panel created', panel: { channel_id, message_id: msg.id, theme } });
    } catch (e) {
        logger.error('Error creating panel:', e);
        res.status(500).json({ success: false, error: 'Failed to create panel' });
    }
});

// Nova rota para detalhes de um ticket específico
app.get('/api/guild/:guildId/tickets/:ticketId', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    try {
        const { guildId, ticketId } = req.params;
        const client = global.discordClient;
        
        if (!client) {
            return res.status(500).json({ success: false, error: 'Bot not available' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        const storage = require('../utils/storage');
        const tickets = await storage.getTickets(guildId);
        const ticket = tickets.find(t => `${t.id}` === `${ticketId}`);
        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }

        // Buscar mensagens do canal do ticket
        let messages = [];
    const channel = guild.channels.cache.get(ticket.channel_id);
        if (channel) {
            try {
                const fetchedMessages = await channel.messages.fetch({ limit: 100 });
                messages = fetchedMessages.map(msg => ({
                    id: msg.id,
                    content: msg.content,
                    author: {
                        id: msg.author.id,
                        username: msg.author.username,
                        discriminator: msg.author.discriminator,
                        avatar: msg.author.displayAvatarURL({ size: 32 })
                    },
                    timestamp: msg.createdAt,
                    embeds: msg.embeds.map(embed => ({
                        title: embed.title,
                        description: embed.description,
                        color: embed.color
                    }))
                })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            } catch (error) {
                logger.error('Erro ao buscar mensagens do ticket:', error);
            }
        }

        // Enriquecer dados do ticket
    const owner = await client.users.fetch(ticket.user_id).catch(() => null);
    const claimedBy = ticket.assigned_to ? await client.users.fetch(ticket.assigned_to).catch(() => null) : null;

        const enrichedTicket = {
            ...ticket,
            channelExists: !!channel,
            channelName: channel?.name || 'Canal deletado',
            ownerTag: owner ? `${owner.username}#${owner.discriminator}` : 'Usuário desconhecido',
            ownerAvatar: owner?.displayAvatarURL({ size: 64 }) || null,
            claimedByTag: claimedBy ? `${claimedBy.username}#${claimedBy.discriminator}` : null,
            claimedByAvatar: claimedBy?.displayAvatarURL({ size: 64 }) || null,
            timeAgo: formatTimeAgo(new Date(ticket.created_at)),
            messages
        };

        // If request asks for transcript download, return a simple text transcript
        if ((req.query.download || '').toString().toLowerCase() === 'transcript') {
            const lines = [];
            lines.push(`Ticket #${enrichedTicket.id} - ${enrichedTicket.category || 'Geral'}`);
            lines.push(`Canal: ${enrichedTicket.channelName} (${enrichedTicket.channel_id})`);
            lines.push(`Aberto por: ${enrichedTicket.ownerTag} (${enrichedTicket.user_id})`);
            lines.push(`Criado em: ${new Date(enrichedTicket.created_at).toLocaleString('pt-PT')}`);
            lines.push(`Status: ${enrichedTicket.status}`);
            lines.push('');
            lines.push('Mensagens:');
            for (const m of messages) {
                const when = new Date(m.timestamp).toLocaleString('pt-PT');
                lines.push(`[${when}] ${m.author?.username || 'Desconhecido'}#${m.author?.discriminator || '0000'}: ${m.content || ''}`);
            }
            const content = lines.join('\n');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=ticket-${enrichedTicket.id}-transcript.txt`);
            return res.send(content);
        }

        res.json({ success: true, ticket: enrichedTicket });
        
    } catch (error) {
        logger.error('Error fetching ticket details:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch ticket details' });
    }
});

// Rota para ações em tickets (claim, close, etc.)
app.post('/api/guild/:guildId/tickets/:ticketId/action', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    try {
        const { guildId, ticketId } = req.params;
        const { action, data } = req.body;
        const client = global.discordClient;
        
        if (!client) {
            return res.status(500).json({ success: false, error: 'Bot not available' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        // Verificar se o usuário é membro do servidor
        const member = await guild.members.fetch(req.user.id).catch(() => null);
        if (!member) {
            return res.status(403).json({ success: false, error: 'You are not a member of this server' });
        }

        const storage = require('../utils/storage');
        const tickets = await storage.getTickets(guildId);
        const ticket = tickets.find(t => `${t.id}` === `${ticketId}`);
        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }

        let success = false;
        let message = '';

        switch (action) {
            case 'claim':
                if (ticket.status === 'open') {
                    await storage.updateTicket(ticketId, {
                        status: 'claimed',
                        claimed_by: req.user.id,
                        assigned_to: req.user.id,
                        claimed_at: new Date().toISOString()
                    });
                    success = true;
                    message = 'Ticket claimed successfully';
                } else {
                    message = 'Ticket cannot be claimed';
                }
                break;

            case 'release':
                if (ticket.status === 'claimed' && (ticket.assigned_to === req.user.id || ticket.claimed_by === req.user.id)) {
                    await storage.updateTicket(ticketId, {
                        status: 'open',
                        assigned_to: null
                    });
                    success = true;
                    message = 'Ticket released';
                } else {
                    message = 'Ticket cannot be released';
                }
                break;

            case 'close':
                if (['open', 'claimed'].includes(ticket.status)) {
                    await storage.updateTicket(ticketId, {
                        status: 'closed',
                        closed_by: req.user.id,
                        closed_at: new Date().toISOString(),
                        close_reason: data?.reason || 'Closed via dashboard'
                    });
                    success = true;
                    message = 'Ticket closed successfully';
                } else {
                    message = 'Ticket cannot be closed';
                }
                break;

            case 'reopen':
                if (ticket.status === 'closed') {
                    await storage.updateTicket(ticketId, {
                        status: 'open',
                        reopened_by: req.user.id,
                        reopened_at: new Date().toISOString()
                    });
                    success = true;
                    message = 'Ticket reopened successfully';
                } else {
                    message = 'Ticket cannot be reopened';
                }
                break;

            case 'assign':
                if (data?.userId) {
                    await storage.updateTicket(ticketId, { assigned_to: data.userId, status: 'claimed' });
                    success = true;
                    message = 'Ticket assigned';
                } else {
                    message = 'Missing userId';
                }
                break;

            case 'reply': {
                const content = data?.content?.trim();
                if (!content) {
                    message = 'Missing content';
                    break;
                }
                const channel = guild.channels.cache.get(ticket.channel_id);
                if (!channel) {
                    message = 'Channel not found';
                    break;
                }
                await channel.send({ content });
                success = true;
                message = 'Reply sent';
                break;
            }

            case 'addNote':
                const notes = Array.isArray(ticket.notes) ? ticket.notes.slice() : [];
                notes.push({ id: Date.now().toString(), content: data.content, author: req.user.id, timestamp: new Date().toISOString() });
                await storage.updateTicket(ticketId, { notes });
                success = true;
                message = 'Note added successfully';
                break;

            default:
                message = 'Invalid action';
        }

        res.json({ success, message });
        
    } catch (error) {
        logger.error('Error performing ticket action:', error);
        res.status(500).json({ success: false, error: 'Failed to perform action' });
    }
});

// Função helper para formatar tempo
function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) return `${days}d atrás`;
    if (hours > 0) return `${hours}h atrás`;
    if (minutes > 0) return `${minutes}m atrás`;
    return 'Agora mesmo';
}

// Start server only if not in bot-only mode
if (config.DISCORD.CLIENT_SECRET && config.DISCORD.CLIENT_SECRET !== 'bot_only') {
    app.listen(PORT, () => {
        const callbackURL = getCallbackURL();
        logger.info(`🌐 Dashboard servidor iniciado em http://localhost:${PORT}`);
        logger.info(`🔑 OAuth Callback URL: ${callbackURL}`);
        logger.info(`🆔 Client ID: ${config.DISCORD.CLIENT_ID}`);
        logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
} else {
    logger.warn('⚠️ Dashboard não iniciado - CLIENT_SECRET não configurado');
}

module.exports = app;
