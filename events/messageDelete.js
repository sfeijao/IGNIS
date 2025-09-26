const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        // Verificações básicas
        if (!message.guild || message.author?.bot) return;
        
        try {
            // Send socket event for dashboard
            if (message.client.socketManager) {
                message.client.socketManager.onDiscordEvent('messageDelete', message.guild.id, {
                    channelId: message.channel.id,
                    channelName: message.channel.name,
                    authorId: message.author?.id,
                    authorName: message.author?.username,
                    messageId: message.id,
                    content: message.content || '[Conteúdo não disponível]',
                    deletedAt: new Date().toISOString()
                });
            }

            // Analytics - registrar mensagem deletada
            if (message.client.database) {
                await message.client.database.recordAnalytics(
                    message.guild.id, 
                    'message_deleted', 
                    1,
                    {
                        channelId: message.channel.id,
                        authorId: message.author?.id,
                        channelName: message.channel.name
                    }
                );
            }

            // Persist mod log
            try {
                const storage = require('../utils/storage');
                await storage.addLog({
                    guild_id: message.guild.id,
                    type: 'mod_message_delete',
                    message: message.id,
                    data: {
                        channelId: message.channel.id,
                        authorId: message.author?.id || null,
                        hasAttachments: Array.isArray(message.attachments) ? message.attachments.size > 0 : false
                    }
                });
            } catch {}
        } catch (error) {
            const logger = require('../utils/logger');
            logger.error('Erro ao processar mensagem deletada:', { error });
        }
    }
};
