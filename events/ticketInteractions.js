const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const logger = require('../utils/logger');
const rateLimit = require('../utils/rateLimit');

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction) {
        // Ignorar interações que não são relacionadas a tickets
        if (!interaction.customId?.startsWith('ticket_')) return;

        // Verificar se a interação já foi respondida (timeout protection)
        if (interaction.replied || interaction.deferred) {
            logger.warn(`Tentativa de processar interação já respondida: ${interaction.customId}`);
            return;
        }

        try {
            // Handle button interactions for tickets
            if (interaction.isButton()) {
                const [_, action, type] = interaction.customId.split('_');

                if (action === 'create') {
                    // CRIAÇÃO DIRETA DE TICKET - sem modal
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    
                    // Verificar rate limit
                    const rateLimitKey = `ticket:${interaction.user.id}`;
                    const { allowed, resetTime } = rateLimit.check(rateLimitKey, 3, 3600000);

                    if (!allowed) {
                        const resetIn = Math.ceil((resetTime - Date.now()) / 60000);
                        return await interaction.editReply({
                            content: `❌ Você atingiu o limite de tickets. Tente novamente em ${resetIn} minutos.`
                        });
                    }

                    // Check for existing tickets
                    const existingTickets = await interaction.client.storage.getUserActiveTickets(
                        interaction.user.id,
                        interaction.guildId
                    );

                    if (existingTickets.length > 0) {
                        return await interaction.editReply({
                            content: `❌ Você já tem um ticket aberto: <#${existingTickets[0].channel_id}>`
                        });
                    }
                    
                    const ticketManager = interaction.client.ticketManager;
                    
                    // Usar descrição padrão baseada no tipo
                    const defaultDescription = `Ticket criado para categoria: ${type}`;
                    
                    // Criar ticket diretamente
                    await ticketManager.handleTicketCreate(interaction, type, defaultDescription);
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
            // Modal submission handler removed - tickets are now created directly without modals
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
