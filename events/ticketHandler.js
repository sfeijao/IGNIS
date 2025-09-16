// Sistema de Tickets Completo - Handler Principal
const { MessageFlags } = require('discord.js');
const TicketInteractionHandler = require('../utils/TicketInteractionHandler');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Só processar interações de tickets
        if (!interaction.customId || !interaction.customId.startsWith('ticket:')) {
            return;
        }

        try {
            // Usar o handler principal para todas as interações de tickets
            const interactionHandler = new TicketInteractionHandler(client);
            return await interactionHandler.handleTicketInteraction(interaction);
        } catch (error) {
            console.error('Erro no handler de tickets:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Erro interno. Contacta um administrador.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
};