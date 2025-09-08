const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
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
                    // Don't defer for modal actions, show modal directly
                    // Verificar rate limit antes de mostrar o modal
                    const rateLimitKey = `ticket:${interaction.user.id}`;
                    const { allowed, resetTime } = rateLimit.check(rateLimitKey, 3, 3600000);

                    if (!allowed) {
                        const resetIn = Math.ceil((resetTime - Date.now()) / 60000);
                        return await interaction.reply({
                            content: `❌ Você atingiu o limite de tickets. Tente novamente em ${resetIn} minutos.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    try {
                        // Check for existing tickets
                        const existingTickets = await interaction.client.storage.getUserActiveTickets(
                            interaction.user.id,
                            interaction.guildId
                        );

                        if (existingTickets.length > 0) {
                            return await interaction.reply({
                                content: `❌ Você já tem um ticket aberto: <#${existingTickets[0].channel_id}>`,
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        // Create and show modal
                    const modal = new ModalBuilder()
                        .setCustomId(`ticket_modal_${type}`)
                        .setTitle('Criar Novo Ticket');

                    const descriptionInput = new TextInputBuilder()
                        .setCustomId('description')
                        .setLabel('Descreva seu problema/solicitação')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Quanto mais detalhes fornecer, mais rápido poderemos ajudar.')
                        .setRequired(true)
                        .setMinLength(10)
                        .setMaxLength(500);

                    const firstActionRow = new ActionRowBuilder().addComponents(descriptionInput);
                    modal.addComponents(firstActionRow);

                        await interaction.showModal(modal);
                    } catch (modalError) {
                        logger.error('Erro ao mostrar modal:', modalError);
                        if (!interaction.replied) {
                            await interaction.reply({
                                content: '❌ Erro ao criar ticket. Por favor, tente novamente.',
                                flags: MessageFlags.Ephemeral
                            }).catch(() => {});
                        }
                    }
                } 
                else {
                    try {
                        // Defer the reply first
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
                                    flags: MessageFlags.Ephemeral
                                });
                        }
                    } catch (actionError) {
                        logger.error('Erro ao processar ação do ticket:', actionError);
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({
                                content: '❌ Erro ao processar ação. Por favor, tente novamente.',
                                flags: MessageFlags.Ephemeral
                            }).catch(() => {});
                        } else if (interaction.deferred) {
                            await interaction.editReply({
                                content: '❌ Erro ao processar ação. Por favor, tente novamente.',
                                flags: MessageFlags.Ephemeral
                            }).catch(() => {});
                        }
                    }
                }
            }
            // Handle modal submissions for ticket creation
            else if (interaction.isModalSubmit()) {
                if (!interaction.customId.startsWith('ticket_modal_')) return;

                try {
                    const description = interaction.fields.getTextInputValue('description');
                    
                    if (!description || description.length < 10 || description.length > 500) {
                        await interaction.reply({
                            content: '❌ A descrição deve ter entre 10 e 500 caracteres.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    const [_, __, type] = interaction.customId.split('_');
                    const ticketManager = interaction.client.ticketManager;
                    
                    const ticket = await ticketManager.createTicket(
                        interaction.guildId,
                        interaction.user.id,
                        null,
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

                    if (!interaction.replied) {
                        await interaction.editReply({
                            content: errorMessage,
                            ephemeral: true
                        });
                    }
                }
            }
        } catch (error) {
            logger.error('Erro ao processar interação de ticket:', error);
            
            // Handle error response
            const response = {
                content: '❌ Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.',
                ephemeral: true
            };

            // Try to send the error response
            try {
                if (interaction.replied) {
                    await interaction.followUp(response);
                } else if (interaction.deferred) {
                    await interaction.editReply(response);
                } else {
                    await interaction.reply(response);
                }
            } catch (followUpError) {
                logger.error('Erro ao enviar resposta de erro:', followUpError);
            }
        }
    }
};
