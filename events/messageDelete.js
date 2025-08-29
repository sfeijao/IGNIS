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
        } catch (error) {
            const logger = require('../utils/logger');
            logger.error('Erro ao processar mensagem deletada:', { error });
        }
    }
};
