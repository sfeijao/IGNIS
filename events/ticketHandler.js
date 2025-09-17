// Sistema de Tickets - Handler Comunitário Simples
const { MessageFlags } = require('discord.js');
const communityTickets = require('../utils/communityTickets');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Só processar botões de tickets com prefixo 'ticket:'
        if (!interaction.isButton() || !interaction.customId || !interaction.customId.startsWith('ticket:')) {
            return;
        }

        try {
            return await communityTickets.handleButton(interaction);
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