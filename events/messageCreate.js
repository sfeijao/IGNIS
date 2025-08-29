const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignorar bots
        if (message.author.bot) return;
        
        // Apenas processar mensagens de servidores
        if (!message.guild) return;
        
        try {
            // Analytics - registrar mensagem criada
            if (message.client.database) {
                await message.client.database.recordAnalytics(
                    message.guild.id, 
                    'message_created', 
                    1,
                    {
                        channelId: message.channel.id,
                        authorId: message.author.id,
                        channelName: message.channel.name,
                        messageLength: message.content.length
                    }
                );
            }
            
            // Send real-time update to dashboard
            if (message.client.socketManager) {
                message.client.socketManager.onDiscordEvent('messageCreate', message.guild.id, {
                    channelId: message.channel.id,
                    channelName: message.channel.name,
                    authorId: message.author.id,
                    authorName: message.author.username,
                    messageLength: message.content.length,
                    hasAttachments: message.attachments.size > 0,
                    createdAt: new Date().toISOString()
                });
            }
        } catch (error) {
            const logger = require('../utils/logger');
            logger.error('Erro ao processar mensagem para analytics:', { error });
        }
    }
};
