// Sistema de Tickets - Handler Comunitário Simples
const { MessageFlags } = require('discord.js');
const logger = require('../utils/logger');
const communityTickets = require('../utils/communityTickets');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Botões e Modals com prefixo 'ticket:'
        try {
            if (interaction.isButton()) {
                if (!interaction.customId || !interaction.customId.startsWith('ticket:')) return;
                // Convergence: try TS ticket handlers first for common actions, fallback to community
                try {
                    const id = interaction.customId || '';
                    const tsActions = new Set(['ticket:cancel','ticket:how_dm','ticket:claim','ticket:close','ticket:close:confirm','ticket:close:cancel','ticket:rename','ticket:move','ticket:move:other','ticket:add_member','ticket:remove_member','ticket:call_member','ticket:greet','ticket:note','ticket:export','ticket:feedback']);
                    if (tsActions.has(id) || id.startsWith('ticket:move:cat:')) {
                        // Defer to TS interaction handler by emitting a synthetic Interaction event pipeline
                        // Simpler approach: require compiled TS handler directly
                        try {
                            const tsHandler = require('../dist/events/interactionCreate.js');
                            if (tsHandler && typeof tsHandler.execute === 'function') {
                                await tsHandler.execute(interaction);
                                // Se o handler TS não respondeu (canal legado), continuar para o comunitário
                                if (interaction.replied || interaction.deferred) return;
                            }
                        } catch (e) { logger.debug('Caught error:', e?.message || e); }
                    }
                } catch (e) { logger.debug('Caught error:', e?.message || e); }
                await communityTickets.handleButton(interaction);
                return;
            }
            if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
                if (!interaction.customId || !interaction.customId.startsWith('ticket:')) return;
                await communityTickets.handleSelect(interaction);
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
