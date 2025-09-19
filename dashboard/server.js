const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
require('dotenv').config();

const config = require('../utils/config');
const logger = require('../utils/logger');

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
if (config.DISCORD.CLIENT_SECRET) {
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
