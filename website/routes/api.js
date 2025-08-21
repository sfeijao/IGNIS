const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const Database = require('../database/database');

const router = express.Router();
const db = new Database();

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Muitas requisições, tente novamente em 15 minutos' }
});

router.use(apiLimiter);

// Middleware de autenticação
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    next();
};

// Middleware de validação de admin
const requireAdmin = (req, res, next) => {
    if (!req.session.user || !req.session.user.permissions?.includes('ADMINISTRATOR')) {
        return res.status(403).json({ error: 'Permissões insuficientes' });
    }
    next();
};

// === ANALYTICS ROUTES ===

// Overview stats
router.get('/analytics/overview', requireAuth, async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        const guildId = req.session.guild.id;
        
        const stats = await db.getAnalyticsOverview(guildId, period);
        
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
        console.error('Erro ao buscar overview analytics:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
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
        console.error('Erro ao buscar analytics de mensagens:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
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
        console.error('Erro ao buscar analytics de membros:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
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
        console.error('Erro ao buscar analytics de comandos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
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
        console.error('Erro ao buscar analytics por hora:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
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
        console.error('Erro ao buscar analytics de moderação:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
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
        console.error('Erro ao buscar atividades:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// === TICKETS ROUTES ===

// Get all tickets
router.get('/tickets', requireAuth, async (req, res) => {
    try {
        const { status, priority, assigned } = req.query;
        const guildId = req.session.guild.id;
        
        const tickets = await db.getTickets(guildId, { status, priority, assigned });
        
        res.json({
            success: true,
            tickets
        });
    } catch (error) {
        console.error('Erro ao buscar tickets:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Get ticket stats
router.get('/tickets/stats', requireAuth, async (req, res) => {
    try {
        const guildId = req.session.guild.id;
        const stats = await db.getTicketStats(guildId);
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas de tickets:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Create ticket
router.post('/tickets', requireAuth, async (req, res) => {
    try {
        const schema = Joi.object({
            title: Joi.string().min(3).max(100).required(),
            description: Joi.string().max(1000).required(),
            priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
            category: Joi.string().max(50).optional()
        });
        
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        
        const guildId = req.session.guild.id;
        const userId = req.session.user.id;
        
        const ticketId = await db.createTicket({
            guild_id: guildId,
            user_id: userId,
            title: value.title,
            description: value.description,
            priority: value.priority,
            category: value.category
        });
        
        res.json({
            success: true,
            ticket_id: ticketId,
            message: 'Ticket criado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao criar ticket:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Update ticket
router.put('/tickets/:id', requireAuth, async (req, res) => {
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
        console.error('Erro ao atualizar ticket:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Add ticket message
router.post('/tickets/:id/messages', requireAuth, async (req, res) => {
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
        const userId = req.session.user.id;
        
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
        console.error('Erro ao adicionar mensagem ao ticket:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// === ADMIN ROUTES ===

// Admin overview
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
        console.error('Erro ao buscar overview admin:', error);
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
        console.error('Erro ao buscar membros:', error);
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
        console.error('Erro ao buscar canais:', error);
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
        console.error('Erro ao buscar cargos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Member actions
router.post('/admin/members/action', requireAdmin, async (req, res) => {
    try {
        const schema = Joi.object({
            action: Joi.string().valid('timeout', 'kick', 'ban', 'unban', 'role').required(),
            memberId: Joi.string().required(),
            reason: Joi.string().max(500).optional(),
            duration: Joi.number().optional(),
            roleId: Joi.string().optional()
        });
        
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        
        const guild = req.session.guild;
        const member = await guild.members.fetch(value.memberId).catch(() => null);
        
        if (!member && value.action !== 'unban') {
            return res.status(404).json({ error: 'Membro não encontrado' });
        }
        
        let result;
        switch (value.action) {
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
        await db.logModerationAction({
            guild_id: guild.id,
            user_id: value.memberId,
            moderator_id: req.session.user.id,
            action: value.action,
            reason: value.reason,
            duration: value.duration
        });
        
        res.json({
            success: true,
            message: `Ação ${value.action} executada com sucesso`
        });
    } catch (error) {
        console.error('Erro ao executar ação de membro:', error);
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
        console.error('Erro ao criar canal:', error);
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
        
        res.json({
            success: true,
            role_id: role.id,
            message: 'Cargo criado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao criar cargo:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Get logs
router.get('/admin/logs', requireAdmin, async (req, res) => {
    try {
        const { type, level } = req.query;
        const guildId = req.session.guild.id;
        
        const logs = await db.getLogs(guildId, { type, level, limit: 100 });
        
        res.json({
            success: true,
            logs
        });
    } catch (error) {
        console.error('Erro ao buscar logs:', error);
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
        console.error('Erro ao salvar configurações:', error);
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
        console.error('Erro ao trancar servidor:', error);
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
        console.error('Erro ao destrancar servidor:', error);
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

module.exports = router;
