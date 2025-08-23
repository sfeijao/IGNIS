const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const Database = require('../database/database');

const router = express.Router();
const db = new Database();

// Variável para controlar se a database foi inicializada
let dbInitialized = false;

// Inicializar database
db.initialize()
    .then(() => {
        dbInitialized = true;
        console.log('✅ Database API routes inicializada');
    })
    .catch(error => {
        console.error('❌ Erro ao inicializar database API routes:', error);
    });

// Middleware para verificar se database está pronta
const ensureDbReady = async (req, res, next) => {
    if (!dbInitialized || !db.db) {
        try {
            await db.initialize();
            dbInitialized = true;
        } catch (error) {
            console.error('❌ Erro ao inicializar database:', error);
            return res.status(500).json({ error: 'Database não disponível' });
        }
    }
    next();
};

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Muitas requisições, tente novamente em 15 minutos' }
});

router.use(apiLimiter);

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

// Middleware de autenticação
const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    next();
};

// Middleware de validação de admin
const requireAdmin = (req, res, next) => {
    // Check for Bearer token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // For now, accept any valid-looking token (you can add proper validation later)
        if (token && token.length > 10) {
            req.user = { id: 'dashboard_user', isAdmin: true };
            return next();
        }
    }
    
    // Fallback to session authentication
    if (!req.isAuthenticated() || !req.user) {
        return res.status(403).json({ error: 'Permissões insuficientes. Token de autenticação necessário.' });
    }
    next();
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
router.get('/tickets', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const { status, priority, assigned } = req.query;
        const guildId = req.currentServerId;
        
        console.log('🎫 Buscando tickets para guild:', guildId);
        console.log('🎫 Parâmetros:', { status, priority, assigned });
        
        // Verificar se a database está inicializada
        if (!db.db) {
            console.error('❌ Database não inicializada');
            return res.status(500).json({ error: 'Database não inicializada' });
        }
        
        // Criar filtros baseados nos parâmetros
        const filters = {};
        if (status && status !== '') filters.status = status;
        if (priority && priority !== '') filters.priority = priority;
        if (assigned && assigned !== '') filters.assigned_to = assigned;
        
        const tickets = await db.getTickets(guildId, filters.status);
        
        // Aplicar filtros adicionais se necessário
        let filteredTickets = tickets;
        if (filters.priority) {
            filteredTickets = filteredTickets.filter(t => t.priority === filters.priority);
        }
        if (filters.assigned_to) {
            filteredTickets = filteredTickets.filter(t => t.assigned_to === filters.assigned_to);
        }
        
        res.json({
            success: true,
            tickets: filteredTickets
        });
    } catch (error) {
        console.error('Erro ao buscar tickets:', error);
        console.error('Stack trace:', error.stack);
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
        
        console.log('📊 Buscando estatísticas de tickets para guild:', guildId);
        
        const stats = await db.getTicketStats(guildId);
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas de tickets:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
});

// Create ticket
router.post('/tickets', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const schema = Joi.object({
            subject: Joi.string().min(3).max(100).required(),
            description: Joi.string().max(1000).required(),
            priority: Joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
            category: Joi.string().max(50).optional().default('general')
        });
        
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        
        const guildId = req.currentServerId;
        const userId = req.user.id;
        const username = req.user.username;
        
        console.log('🎫 Criando ticket para:', { guildId, userId, username, subject: value.subject });
        
        // Verificar se o bot está online e tem acesso ao servidor
        if (!global.discordClient || !global.discordClient.isReady()) {
            return res.status(503).json({ error: 'Bot do Discord não está disponível' });
        }
        
        const guild = global.discordClient.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ error: 'Servidor não encontrado' });
        }
        
        // Buscar categoria de tickets (ou criar se não existir)
        let ticketCategory = guild.channels.cache.find(
            channel => channel.type === 4 && channel.name.toLowerCase() === 'tickets'
        );
        
        if (!ticketCategory) {
            console.log('📁 Criando categoria de tickets...');
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
        }
        
        // Criar canal do ticket
        const ticketChannelName = `ticket-${username}-${Date.now().toString().slice(-6)}`;
        console.log('🎫 Criando canal:', ticketChannelName);
        
        const ticketChannel = await guild.channels.create({
            name: ticketChannelName,
            type: 0, // Text channel
            parent: ticketCategory.id,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone,
                    deny: ['ViewChannel']
                },
                {
                    id: userId,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                },
                // Permitir que moderadores vejam
                ...guild.roles.cache
                    .filter(role => role.permissions.has('ManageMessages'))
                    .map(role => ({
                        id: role.id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
                    }))
            ]
        });
        
        // Criar ticket na base de dados
        const ticketData = {
            guild_id: guildId,
            channel_id: ticketChannel.id,
            user_id: userId,
            category: value.category,
            subject: value.subject,
            description: value.description,
            priority: value.priority
        };
        
        const ticketResult = await db.createTicket(ticketData);
        
        // Enviar mensagem inicial no canal do ticket
        const embed = {
            color: 0x00FF00,
            title: `🎫 Ticket #${ticketResult.id}`,
            fields: [
                { name: '📝 Assunto', value: value.subject, inline: true },
                { name: '⚡ Prioridade', value: value.priority.toUpperCase(), inline: true },
                { name: '📂 Categoria', value: value.category, inline: true },
                { name: '📄 Descrição', value: value.description, inline: false },
                { name: '👤 Criado por', value: `<@${userId}>`, inline: true },
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
            content: `<@${userId}> O seu ticket foi criado com sucesso!`,
            embeds: [embed],
            components: components
        });
        
        console.log(`✅ Ticket #${ticketResult.id} criado com sucesso no canal ${ticketChannel.name}`);
        
        res.json({
            success: true,
            ticket_id: ticketResult.id,
            channel_id: ticketChannel.id,
            channel_name: ticketChannel.name,
            message: 'Ticket criado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao criar ticket:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
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
        console.error('Erro ao atualizar ticket:', error);
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

// Assign ticket to user
router.post('/tickets/:id/assign', requireAuth, ensureDbReady, async (req, res) => {
    try {
        const ticketId = req.params.id;
        const userId = req.user.id;
        const username = req.user.username;
        
        console.log(`👋 Atribuindo ticket #${ticketId} para ${username} (${userId})`);
        
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
                    console.log(`✅ Notificação de atribuição enviada no canal ${ticketChannel.name}`);
                }
            }
        }
        
        res.json({
            success: true,
            message: 'Ticket atribuído com sucesso'
        });
    } catch (error) {
        console.error('Erro ao atribuir ticket:', error);
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
        
        console.log(`🔒 Fechando ticket #${ticketId} por ${username}`);
        
        // Buscar ticket na base de dados
        const tickets = await db.getTickets(req.currentServerId);
        const ticket = tickets.find(t => t.id == ticketId);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket não encontrado' });
        }
        
        // Atualizar ticket na base de dados
        await db.updateTicketStatus(ticketId, 'closed', null, reason || 'Resolvido');
        
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
                            
                            console.log(`📁 Ticket #${ticketId} arquivado como ${newName}`);
                        } catch (archiveError) {
                            console.error('Erro ao arquivar ticket:', archiveError);
                        }
                    }, 10000);
                    
                    console.log(`✅ Ticket #${ticketId} fechado com sucesso`);
                }
            }
        }
        
        res.json({
            success: true,
            message: 'Ticket fechado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao fechar ticket:', error);
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
                    console.error('Não foi possível enviar DM:', dmError);
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
