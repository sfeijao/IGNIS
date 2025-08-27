const { Events } = require('discord.js');
const Database = require('../website/database/database');

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel, client) {
        try {
            // Verificar se é um canal de ticket
            if (channel.type === 0 && channel.parentId) { // GuildText channel com categoria
                const category = channel.parent;
                
                // Verificar se é da categoria de tickets
                if (category && category.name === '📁 TICKETS') {
                    console.log(`🗑️ Canal de ticket apagado: ${channel.name} (${channel.id})`);
                    
                    // Atualizar status do ticket na base de dados
                    try {
                        const db = new Database();
                        await db.initialize();
                        
                        // Buscar ticket pela channel_id
                        const ticket = await db.getTicketByChannelId(channel.id);
                        
                        if (ticket) {
                            // Marcar como fechado/arquivado
                            await db.updateTicketStatus(ticket.id, 'archived', null, 'Canal apagado automaticamente');
                            console.log(`✅ Ticket ${ticket.id} marcado como arquivado na base de dados`);
                            
                            // Notificar dashboard via Socket.IO
                            if (global.socketManager) {
                                global.socketManager.broadcast('ticket_deleted', {
                                    id: ticket.id,
                                    channelId: channel.id,
                                    channelName: channel.name,
                                    guildId: channel.guild.id,
                                    timestamp: new Date().toISOString()
                                });
                                console.log('📡 Socket.IO: Ticket deletion enviado para dashboard');
                            }
                        }
                        
                    } catch (dbError) {
                        console.error('❌ Erro ao atualizar ticket na base de dados:', dbError);
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ Erro no evento channelDelete:', error);
        }
    }
};
