const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction) {
        try {
            // Handle button interactions for tickets
            if (interaction.isButton() && interaction.customId.startsWith('ticket_')) {
                // Defer reply immediately to prevent "thinking..." message stuck
                await interaction.deferReply({ ephemeral: true });

                // Extract action and type from customId
                const [_, action, type] = interaction.customId.split('_');
                const ticketManager = interaction.client.ticketManager;

                switch (action) {
                    case 'create':
                        // Handle ticket creation - shows modal
                        await ticketManager.handleTicketCreate(interaction, type);
                        break;
                    case 'close':
                        // Handle ticket closure
                        await ticketManager.handleTicketClose(interaction);
                        break;
                    case 'claim':
                        // Handle ticket claim
                        await ticketManager.handleTicketClaim(interaction);
                        break;
                    default:
                        await interaction.editReply({
                            content: '❌ Ação de ticket inválida.',
                            ephemeral: true
                        });
                }
            }
            // Handle modal submissions for ticket creation
            else if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
                // Defer reply immediately
                await interaction.deferReply({ ephemeral: true });

                try {
                    const type = interaction.customId.split('_')[2];
                    const ticketManager = interaction.client.ticketManager;
                    
                    // Get the description from modal
                    const description = interaction.fields.getTextInputValue('description');

                    // Create the ticket
                    const ticket = await ticketManager.createTicket(
                        interaction.guildId,
                        interaction.user.id,
                        null, // channelId will be set during creation
                        {
                            type,
                            description,
                            priority: 'normal',
                            category: type
                        }
                    );

                    await interaction.editReply({
                        content: `✅ Ticket criado com sucesso! <#${ticket.channel_id}>`,
                        ephemeral: true
                    });

                } catch (error) {
                    logger.error('Erro ao processar modal de ticket:', error);
                    
                    let errorMessage = '❌ Ocorreu um erro ao criar o ticket.';
                    if (error.message === 'USER_HAS_OPEN_TICKET') {
                        errorMessage = '❌ Você já possui um ticket aberto.';
                    }

                    await interaction.editReply({
                        content: errorMessage,
                        ephemeral: true
                    });
                }
            }
        } catch (error) {
            logger.error('Erro ao processar interação de ticket:', error);
            
            // Try to send error response
            try {
                const response = {
                    content: '❌ Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.',
                    ephemeral: true
                };

                if (interaction.deferred) {
                    await interaction.editReply(response);
                } else {
                    await interaction.reply(response);
                }
            } catch (followUpError) {
                logger.error('Erro ao enviar resposta de erro:', followUpError);
            }
        }
    },
};
