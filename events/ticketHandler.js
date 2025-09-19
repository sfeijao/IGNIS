// Sistema de Tickets - Handler Comunitário Simples
const { MessageFlags } = require('discord.js');
const communityTickets = require('../utils/communityTickets');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Botões e Modals com prefixo 'ticket:'
        try {
            if (interaction.isButton()) {
                if (!interaction.customId || !interaction.customId.startsWith('ticket:')) return;
                await communityTickets.handleButton(interaction);
                return;
            }
            if (interaction.isModalSubmit()) {
                if (!interaction.customId || !interaction.customId.startsWith('ticket:')) return;
                await communityTickets.handleModal(interaction);
                return;
            }
        } catch (error) {
            console.error('Erro no handler de tickets:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Erro interno. Contacta um administrador.', flags: MessageFlags.Ephemeral });
            }
        }
    }
};