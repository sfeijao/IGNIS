const socketIo = require('socket.io');
const Database = require('./database/database');
const logger = require('../../utils/logger');

class SocketManager {
    constructor(server) {
        this.io = socketIo(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.db = new Database();
        this.connectedUsers = new Map();
        
        this.initializeDatabase();
        this.setupSocketHandlers();
    }
    
    async initializeDatabase() {
        try {
            await this.db.initialize();
            logger.info('SocketManager: Database initialized successfully');
        } catch (error) {
            logger.error('SocketManager: Database initialization failed', { error: error && error.stack ? error.stack : error });
            this.db = null; // Set to null to prevent further errors
        }
    }
    
    // Método auxiliar para verificar se a database está disponível
    isDatabaseReady() {
        return this.db && this.db.db;
    }
    
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
                logger.info(`Usuário conectado: ${socket.id}`);
            
            // Autenticação do socket
            socket.on('authenticate', (data) => {
                this.authenticateSocket(socket, data);
            });
            
            // Dashboard events
            socket.on('join_dashboard', (guildId) => {
                socket.join(`dashboard_${guildId}`);
                logger.debug(`Socket ${socket.id} entrou no dashboard ${guildId}`);
            });
            
            socket.on('leave_dashboard', (guildId) => {
                socket.leave(`dashboard_${guildId}`);
                logger.debug(`Socket ${socket.id} saiu do dashboard ${guildId}`);
            });
            
            // Ticket events
            socket.on('join_tickets', (guildId) => {
                socket.join(`tickets_${guildId}`);
                logger.debug(`Socket ${socket.id} entrou nos tickets ${guildId}`);
            });
            
            socket.on('create_ticket', async (data) => {
                await this.handleCreateTicket(socket, data);
            });
            
            socket.on('update_ticket', async (data) => {
                await this.handleUpdateTicket(socket, data);
            });
            
            socket.on('add_ticket_message', async (data) => {
                await this.handleAddTicketMessage(socket, data);
            });
            
            // Analytics events
            socket.on('request_analytics_update', (guildId) => {
                this.sendAnalyticsUpdate(guildId);
            });
            
            // Admin events
            socket.on('admin_action', async (data) => {
                await this.handleAdminAction(socket, data);
            });
            
            // Moderation events
            socket.on('moderation_action', async (data) => {
                await this.handleModerationAction(socket, data);
            });
            
            // Disconnect
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }
    
    authenticateSocket(socket, data) {
        try {
            if (data.userId && data.guildId) {
                socket.userId = data.userId;
                socket.guildId = data.guildId;
                socket.authenticated = true;
                
                this.connectedUsers.set(socket.id, {
                    userId: data.userId,
                    guildId: data.guildId,
                    connectedAt: new Date()
                });
                
                socket.emit('authenticated', { success: true });
                logger.info(`Socket ${socket.id} autenticado para usuário ${data.userId}`);
            } else {
                socket.emit('authentication_error', { error: 'Dados de autenticação inválidos' });
            }
        } catch (error) {
            logger.error('Erro na autenticação do socket', { error: error && error.stack ? error.stack : error });
            socket.emit('authentication_error', { error: 'Erro na autenticação' });
        }
    }
    
    async handleCreateTicket(socket, data) {
        try {
            if (!socket.authenticated) {
                socket.emit('error', { message: 'Socket não autenticado' });
                return;
            }
            
            if (!this.isDatabaseReady()) {
                socket.emit('error', { message: 'Database não disponível' });
                return;
            }
            
            const ticketId = await this.db.createTicket({
                guild_id: socket.guildId,
                user_id: socket.userId,
                title: data.title,
                description: data.description,
                priority: data.priority || 'medium',
                category: data.category
            });
            
            const ticket = await this.db.getTicketById(ticketId);
            
            // Notificar todos os usuários conectados aos tickets
            this.io.to(`tickets_${socket.guildId}`).emit('ticket_created', {
                ticket,
                message: 'Novo ticket criado'
            });
            
            // Notificar admins
            this.notifyAdmins(socket.guildId, 'new_ticket', {
                ticketId,
                title: data.title,
                priority: data.priority
            });
            
            socket.emit('ticket_create_success', { ticketId });
            
        } catch (error) {
            logger.error('Erro ao criar ticket via socket', { error: error && error.stack ? error.stack : error });
            socket.emit('error', { message: 'Erro ao criar ticket' });
        }
    }
    
    async handleUpdateTicket(socket, data) {
        try {
            if (!socket.authenticated) {
                socket.emit('error', { message: 'Socket não autenticado' });
                return;
            }
            
            const success = await this.db.updateTicket(data.ticketId, data.updates);
            
            if (success) {
                const ticket = await this.db.getTicketById(data.ticketId);
                
                // Notificar todos os usuários conectados aos tickets
                this.io.to(`tickets_${socket.guildId}`).emit('ticket_updated', {
                    ticket,
                    updates: data.updates
                });
                
                socket.emit('ticket_update_success', { ticketId: data.ticketId });
            } else {
                socket.emit('error', { message: 'Ticket não encontrado' });
            }
            
        } catch (error) {
            logger.error('Erro ao atualizar ticket via socket', { error: error && error.stack ? error.stack : error });
            socket.emit('error', { message: 'Erro ao atualizar ticket' });
        }
    }
    
    async handleAddTicketMessage(socket, data) {
        try {
            if (!socket.authenticated) {
                socket.emit('error', { message: 'Socket não autenticado' });
                return;
            }
            
            const messageId = await this.db.addTicketMessage({
                ticket_id: data.ticketId,
                user_id: socket.userId,
                message: data.message,
                is_internal: data.isInternal || false
            });
            
            const message = await this.db.getTicketMessageById(messageId);
            
            // Notificar todos os usuários conectados aos tickets
            this.io.to(`tickets_${socket.guildId}`).emit('ticket_message_added', {
                ticketId: data.ticketId,
                message
            });
            
            socket.emit('message_add_success', { messageId });
            
        } catch (error) {
            logger.error('Erro ao adicionar mensagem ao ticket via socket', { error: error && error.stack ? error.stack : error });
            socket.emit('error', { message: 'Erro ao adicionar mensagem' });
        }
    }
    
    async handleAdminAction(socket, data) {
        try {
            if (!socket.authenticated) {
                socket.emit('error', { message: 'Socket não autenticado' });
                return;
            }
            
            // Log da ação administrativa
            await this.db.createLog({
                guild_id: socket.guildId,
                user_id: socket.userId,
                type: 'admin_action',
                description: `Ação administrativa: ${data.action}`,
                details: JSON.stringify(data),
                timestamp: new Date().toISOString()
            });
            
            // Notificar dashboard em tempo real
            this.io.to(`dashboard_${socket.guildId}`).emit('admin_action_performed', {
                action: data.action,
                user: socket.userId,
                timestamp: new Date(),
                details: data
            });
            
        } catch (error) {
            logger.error('Erro ao processar ação administrativa', { error: error && error.stack ? error.stack : error });
            socket.emit('error', { message: 'Erro ao processar ação' });
        }
    }
    
    async handleModerationAction(socket, data) {
        try {
            if (!socket.authenticated) {
                socket.emit('error', { message: 'Socket não autenticado' });
                return;
            }
            
            // Log da ação de moderação
            await this.db.logModerationAction({
                guild_id: socket.guildId,
                user_id: data.targetUserId,
                moderator_id: socket.userId,
                action: data.action,
                reason: data.reason,
                duration: data.duration
            });
            
            // Notificar dashboard em tempo real
            this.io.to(`dashboard_${socket.guildId}`).emit('moderation_action_performed', {
                action: data.action,
                target: data.targetUserId,
                moderator: socket.userId,
                reason: data.reason,
                timestamp: new Date()
            });
            
            // Atualizar estatísticas de moderação em tempo real
            this.sendModerationStatsUpdate(socket.guildId);
            
        } catch (error) {
            logger.error('Erro ao processar ação de moderação', { error: error && error.stack ? error.stack : error });
            socket.emit('error', { message: 'Erro ao processar ação de moderação' });
        }
    }
    
    handleDisconnect(socket) {
        const user = this.connectedUsers.get(socket.id);
        if (user) {
            logger.info(`Usuário ${user.userId} desconectado: ${socket.id}`);
            this.connectedUsers.delete(socket.id);
        }
    }
    
    // Métodos para enviar atualizações
    
    async sendAnalyticsUpdate(guildId) {
        if (!this.isDatabaseReady()) {
            logger.warn('Database not ready, skipping analytics update');
            return;
        }
        
        try {
            const stats = await this.db.getAnalytics(guildId, 'message_created', 1);
            
            this.io.to(`dashboard_${guildId}`).emit('analytics_update', {
                stats,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Erro ao enviar atualização de analytics', { error: error && error.stack ? error.stack : error });
        }
    }
    
    async sendModerationStatsUpdate(guildId) {
        if (!this.isDatabaseReady()) {
            logger.warn('Database not ready, skipping moderation stats update');
            return;
        }
        
        try {
            // const stats = await this.db.getModerationStats(guildId);
            // Método não implementado - usar dados mock ou implementar depois
            const stats = { warnings: 0, kicks: 0, bans: 0, timeouts: 0 };
            
            this.io.to(`dashboard_${guildId}`).emit('moderation_stats_update', {
                stats,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Erro ao enviar atualização de stats de moderação', { error: error && error.stack ? error.stack : error });
        }
    }
    
    async sendTicketStatsUpdate(guildId) {
        if (!this.isDatabaseReady()) {
            logger.warn('Database not ready, skipping ticket stats update');
            return;
        }
        
        try {
            const stats = await this.db.getTicketStats(guildId);
            
            this.io.to(`tickets_${guildId}`).emit('ticket_stats_update', {
                stats,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Erro ao enviar atualização de stats de tickets', { error: error && error.stack ? error.stack : error });
        }
    }
    
    // Notificações específicas
    
    notifyAdmins(guildId, type, data) {
        this.io.to(`dashboard_${guildId}`).emit('admin_notification', {
            type,
            data,
            timestamp: new Date()
        });
    }
    
    notifyModerators(guildId, type, data) {
        this.io.to(`dashboard_${guildId}`).emit('moderator_notification', {
            type,
            data,
            timestamp: new Date()
        });
    }
    
    // Métodos para serem chamados pelo bot Discord
    
    async onDiscordEvent(eventType, guildId, data) {
        try {
            switch (eventType) {
                case 'messageCreate':
                    await this.handleDiscordMessage(guildId, data);
                    break;
                    
                case 'guildMemberAdd':
                    await this.handleMemberJoin(guildId, data);
                    break;
                    
                case 'guildMemberRemove':
                    await this.handleMemberLeave(guildId, data);
                    break;
                    
                case 'messageDelete':
                    await this.handleMessageDelete(guildId, data);
                    break;
                    
                case 'voiceStateUpdate':
                    await this.handleVoiceUpdate(guildId, data);
                    break;
            }
        } catch (error) {
            logger.error(`Erro ao processar evento ${eventType}`, { error: error && error.stack ? error.stack : error });
        }
    }
    
    async handleDiscordMessage(guildId, data) {
            if (!this.isDatabaseReady()) {
                logger.warn('⚠️ Database not ready, skipping message analytics');
            return;
        }
        
        try {
            // Atualizar estatísticas de mensagens em tempo real
            await this.db.recordAnalytics(guildId, 'message_created', 1, {
                channelId: data.channelId,
                authorId: data.authorId
            });
            } catch (error) {
                logger.error('Erro ao registrar analytics de mensagem', { error: error && error.message ? error.message : error, stack: error && error.stack });
        }
        
        // Enviar atualização para dashboard
        this.io.to(`dashboard_${guildId}`).emit('new_message', {
            channelId: data.channelId,
            authorId: data.authorId,
            timestamp: new Date()
        });
    }
    
    async handleMemberJoin(guildId, data) {
        if (!this.isDatabaseReady()) {
                    logger.warn('⚠️ Database not ready, skipping member join log');
            return;
        }
        
        try {
            // Log de entrada
            await this.db.createLog({
                guild_id: guildId,
                user_id: data.userId,
                type: 'member_join',
                description: `${data.username} entrou no servidor`,
                timestamp: new Date().toISOString()
            });
            } catch (error) {
                logger.error('Erro ao registrar entrada de membro', { error: error && error.message ? error.message : error, stack: error && error.stack });
        }
        
        // Notificar dashboard
        this.io.to(`dashboard_${guildId}`).emit('member_joined', {
            userId: data.userId,
            username: data.username,
            timestamp: new Date()
        });
        
        // Atualizar estatísticas
        this.sendAnalyticsUpdate(guildId);
    }
    
    async handleMemberLeave(guildId, data) {
        if (!this.isDatabaseReady()) {
                    logger.warn('⚠️ Database not ready, skipping member leave log');
            return;
        }
        
        try {
            // Log de saída
            await this.db.createLog({
                guild_id: guildId,
                user_id: data.userId,
                type: 'member_leave',
                description: `${data.username} saiu do servidor`,
                timestamp: new Date().toISOString()
            });
            } catch (error) {
                logger.error('Erro ao registrar saída de membro', { error: error && error.message ? error.message : error, stack: error && error.stack });
        }
        
        // Notificar dashboard
        this.io.to(`dashboard_${guildId}`).emit('member_left', {
            userId: data.userId,
            username: data.username,
            timestamp: new Date()
        });
        
        // Atualizar estatísticas
        this.sendAnalyticsUpdate(guildId);
    }
    
    async handleMessageDelete(guildId, data) {
        if (!this.isDatabaseReady()) {
                    logger.warn('⚠️ Database not ready, skipping message delete log');
            return;
        }
        
        try {
            // Log de mensagem deletada
            await this.db.createLog({
                guild_id: guildId,
                user_id: data.authorId,
                type: 'message_delete',
                description: `Mensagem deletada no canal ${data.channelName}`,
                details: JSON.stringify({
                    channelId: data.channelId,
                    messageId: data.messageId,
                    content: data.content?.substring(0, 100) || 'Conteúdo não disponível'
                }),
                timestamp: new Date().toISOString()
            });
            } catch (error) {
                logger.error('Erro ao registrar deleção de mensagem', { error: error && error.message ? error.message : error, stack: error && error.stack });
        }
        
        // Notificar moderadores
        this.notifyModerators(guildId, 'message_deleted', {
            channelId: data.channelId,
            authorId: data.authorId,
            messageId: data.messageId,
            content: data.content
        });
    }
    
    async handleVoiceUpdate(guildId, data) {
        // Verificar se a database está inicializada
        if (!this.isDatabaseReady()) {
                    logger.warn('⚠️ Database not ready, skipping voice update log');
            return;
        }
        
        try {
            if (data.joined) {
                await this.db.createLog({
                    guild_id: guildId,
                    user_id: data.userId,
                    type: 'voice_join',
                    description: `Entrou no canal de voz ${data.channelName}`,
                    timestamp: new Date().toISOString()
                });
            } else if (data.left) {
                await this.db.createLog({
                    guild_id: guildId,
                    user_id: data.userId,
                    type: 'voice_leave',
                    description: `Saiu do canal de voz ${data.channelName}`,
                    timestamp: new Date().toISOString()
                });
                
                // Calcular tempo em voz se disponível
                if (data.duration) {
                    // await this.db.updateVoiceTime(guildId, data.userId, data.duration);
                    // Método não implementado - pode ser implementado depois se necessário
                    logger.debug('Voice time update', { userId: data.userId, durationMs: data.duration });
                }
            }
            } catch (error) {
                logger.error('Erro ao processar atualização de voz', { error: error && error.message ? error.message : error, stack: error && error.stack });
        }
        
        // Notificar dashboard sobre mudanças de voz
        this.io.to(`dashboard_${guildId}`).emit('voice_update', {
            userId: data.userId,
            channelId: data.channelId,
            action: data.joined ? 'joined' : 'left',
            timestamp: new Date()
        });
    }
    
    // Métodos utilitários
    
    getConnectedUsersCount(guildId) {
        let count = 0;
        for (const user of this.connectedUsers.values()) {
            if (user.guildId === guildId) {
                count++;
            }
        }
        return count;
    }
    
    broadcastToGuild(guildId, event, data) {
        this.io.to(`dashboard_${guildId}`).emit(event, data);
    }
    
    broadcastSystemMessage(guildId, message, type = 'info') {
        this.io.to(`dashboard_${guildId}`).emit('system_message', {
            message,
            type,
            timestamp: new Date()
        });
    }
}

module.exports = SocketManager;
