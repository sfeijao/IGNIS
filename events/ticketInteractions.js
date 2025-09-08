const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const logger = require('../utils/logger');
const rateLimit = require('../utils/rateLimit');

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction) {
        // Ignorar interações que não são relacionadas a tickets
        if (!interaction.customId?.startsWith('ticket_')) return;
        try {
            // Handle button interactions for tickets
            if (interaction.isButton()) {
                const [_, action, type] = interaction.customId.split('_');

                if (action === 'create') {
                    // Verificar rate limit antes de mostrar o modal
                    const rateLimitKey = `ticket:${interaction.user.id}`;
                    const { allowed, resetTime } = rateLimit.check(rateLimitKey, 3, 3600000);

                    if (!allowed) {
                        const resetIn = Math.ceil((resetTime - Date.now()) / 60000);
                        return await interaction.reply({
                            content: `❌ Você atingiu o limite de tickets. Tente novamente em ${resetIn} minutos.`,
                            ephemeral: true
                        });
                    }

                    // Check for existing tickets
                    const existingTickets = await interaction.client.storage.getUserActiveTickets(
                        interaction.user.id,
                        interaction.guildId
                    );

                    if (existingTickets.length > 0) {
                        return await interaction.reply({
                            content: `❌ Você já tem um ticket aberto: <#${existingTickets[0].channelId}>`,
                            ephemeral: true
                        });
                    }

                    // Create and show modal
                    const modal = new ModalBuilder()
                        .setCustomId(`ticket_modal_${type}`)
                        .setTitle('Criar Novo Ticket');

                    const descriptionInput = new TextInputBuilder()
                        .setCustomId('description')
                        .setLabel('Descreva detalhadamente seu problema/solicitação')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Quanto mais detalhes fornecer, mais rápido poderemos ajudar.')
                        .setRequired(true)
                        .setMinLength(20)
                        .setMaxLength(1000);

                    const firstActionRow = new ActionRowBuilder().addComponents(descriptionInput);
                    modal.addComponents(firstActionRow);

                    await interaction.showModal(modal);
                } 
                else {
                    // For other actions, defer reply first
                    await interaction.deferReply({ ephemeral: true });
                    const ticketManager = interaction.client.ticketManager;

                    switch (action) {
                        case 'close':
                            await ticketManager.handleTicketClose(interaction);
                            break;
                        case 'claim':
                            await ticketManager.handleTicketClaim(interaction);
                            break;
                        default:
                            await interaction.editReply({
                                content: '❌ Ação de ticket inválida.',
                                ephemeral: true
                            });
                    }
                }
            }
            // Handle modal submissions for ticket creation
            else if (interaction.isModalSubmit()) {
                // Get the description immediately
                const description = interaction.fields.getTextInputValue('description');
                const [_, __, type] = interaction.customId.split('_');

                // Now defer the reply
                await interaction.deferReply({ ephemeral: true });

                try {
                    const ticketManager = interaction.client.ticketManager;
                    
                    // Create ticket
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

                    // Update the deferred reply
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
