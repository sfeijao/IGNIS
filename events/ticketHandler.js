const { PermissionFlagsBits } = require('discord.js');
const TicketManager = require('../utils/ticketManager');
const rateLimit = require('../utils/rateLimit');
const {
    ticketTypes,
    ticketStatus
} = require('../constants/ticketConstants');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Ignorar interações que não são de botões ou modais
        if (!interaction.isButton() && !interaction.isModalSubmit()) return;
        if (!interaction.customId.startsWith('ticket_')) return;

        const ticketManager = new TicketManager(client);

        try {
            const [action, ...args] = interaction.customId.split('_');

            // Verificar permissões básicas
            if (!interaction.member || !interaction.guild) {
                return await interaction.reply({
                    content: '❌ Este comando só pode ser usado em servidores.',
                    ephemeral: true
                });
            }

            // Obter configuração do servidor
            const guildConfig = await client.storage.getGuildConfig(interaction.guild.id);
            
            // Verificar se a configuração existe e tem as propriedades necessárias
            if (!guildConfig || !guildConfig.ticketStaffRoleId) {
                return await interaction.reply({
                    content: '❌ Sistema de tickets não configurado corretamente. Use `/configurar-painel-tickets` para configurar o sistema.',
                    ephemeral: true
                });
            }
            
            // Verificar se o cargo ainda existe no servidor
            try {
                const staffRole = await interaction.guild.roles.fetch(guildConfig.ticketStaffRoleId);
                if (!staffRole) {
                    return await interaction.reply({
                        content: '❌ O cargo de staff configurado não existe mais no servidor. Use `/configurar-painel-tickets` para reconfigurar.',
                        ephemeral: true
                    });
                }
            } catch (error) {
                return await interaction.reply({
                    content: '❌ Erro ao verificar cargo de staff. Use `/configurar-painel-tickets` para reconfigurar.',
                    ephemeral: true
                });
            }

            // Processar diferentes ações
            switch(args[0]) {
                case 'create':
                    await handleTicketCreate(interaction, args[1], ticketManager);
                    break;

                case 'close':
                    await handleTicketClose(interaction, args[1], ticketManager, guildConfig);
                    break;

                case 'assign':
                    await handleTicketAssign(interaction, args[1], ticketManager, guildConfig);
                    break;

                case 'modal':
                    if (args[1] === 'close') {
                        await handleCloseModal(interaction, args[2], ticketManager);
                    }
                    break;
            }

        } catch (error) {
            console.error('Erro ao processar interação de ticket:', error);
            const response = {
                content: '❌ Ocorreu um erro ao processar sua solicitação.',
                ephemeral: true
            };

            if (interaction.deferred) {
                await interaction.editReply(response);
            } else {
                await interaction.reply(response);
            }
        }
    }
};

// Funções auxiliares
async function handleTicketCreate(interaction, type, ticketManager) {
    // Verificar rate limit
    const rateLimitKey = `ticket:${interaction.user.id}`;
    const { allowed, resetTime, remaining } = rateLimit.check(rateLimitKey, 3, 3600000); // 3 tickets por hora

    if (!allowed) {
        const resetIn = Math.ceil((resetTime - Date.now()) / 60000); // Converter para minutos
        return await interaction.reply({
            content: `❌ Você atingiu o limite de tickets. Tente novamente em ${resetIn} minutos.`,
            ephemeral: true
        });
    }

    if (!ticketManager.isValidTicketType(type)) {
        return await interaction.reply({
            content: '❌ Tipo de ticket inválido.',
            ephemeral: true
        });
    }

    // Verificar se usuário já tem ticket aberto
    const openTickets = await ticketManager.getUserTickets(interaction.guild.id, interaction.user.id);
    const hasOpenTicket = openTickets.some(t => t.status === 'open' || t.status === 'assigned');

    if (hasOpenTicket) {
        return await interaction.reply({
            content: `❌ Você já tem um ticket aberto: <#${openTickets.find(t => t.status !== 'closed').channel_id}>`,
            ephemeral: true
        });
    }

    // Mostrar modal para criação do ticket
    const modal = require('../utils/ticketModals').createTicketModal(type);
    
    // Informar tickets restantes se estiver próximo do limite
    if (remaining <= 1) {
        await interaction.reply({
            content: `⚠️ Você tem apenas ${remaining} ticket(s) disponível(is) na próxima hora.`,
            ephemeral: true
        });
    }
    
    await interaction.showModal(modal);
}

async function handleTicketClose(interaction, ticketId, ticketManager, guildConfig) {
    const ticket = await ticketManager.storage.getTicket(ticketId);
    if (!ticket) {
        return await interaction.reply({
            content: '❌ Ticket não encontrado.',
            ephemeral: true
        });
    }

    // Verificar permissões
    const canClose = interaction.member.roles.cache.has(guildConfig.ticketStaffRoleId) ||
                    ticket.user_id === interaction.user.id ||
                    interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

    if (!canClose) {
        return await interaction.reply({
            content: '❌ Você não tem permissão para fechar este ticket.',
            ephemeral: true
        });
    }

    // Mostrar modal de confirmação
    const modal = require('../utils/ticketModals').createCloseModal(ticketId);
    await interaction.showModal(modal);
}

async function handleTicketAssign(interaction, ticketId, ticketManager, guildConfig) {
    // Verificar permissões
    if (!interaction.member.roles.cache.has(guildConfig.ticketStaffRoleId)) {
        return await interaction.reply({
            content: '❌ Apenas membros da equipe podem atribuir tickets.',
            ephemeral: true
        });
    }

    await interaction.deferReply();

    const ticket = await ticketManager.assignTicket(ticketId, interaction.user.id);
    if (!ticket) {
        return await interaction.editReply({
            content: '❌ Ticket não encontrado.',
            ephemeral: true
        });
    }

    const embed = ticketManager.getTicketEmbed(ticket);
    const buttons = ticketManager.getTicketButtons(ticket);

    await interaction.channel.messages.fetch({ limit: 1 }).then(async messages => {
        const firstMessage = messages.first();
        if (firstMessage && firstMessage.embeds.length > 0) {
            await firstMessage.edit({ embeds: [embed], components: [buttons] });
        }
    });

    await interaction.editReply({
        content: `✅ Ticket atribuído para ${interaction.user}`,
        ephemeral: true
    });
}

async function handleCloseModal(interaction, ticketId, ticketManager) {
    const reason = interaction.fields.getTextInputValue('close_reason');
    await interaction.deferReply();

    const ticket = await ticketManager.closeTicket(ticketId, interaction.user.id, reason);
    if (!ticket) {
        return await interaction.editReply({
            content: '❌ Ticket não encontrado.',
            ephemeral: true
        });
    }

    // Atualizar mensagem original
    const embed = ticketManager.getTicketEmbed(ticket);
    await interaction.channel.messages.fetch({ limit: 1 }).then(async messages => {
        const firstMessage = messages.first();
        if (firstMessage && firstMessage.embeds.length > 0) {
            await firstMessage.edit({ embeds: [embed], components: [] });
        }
    });

    // Enviar mensagem de fechamento
    await interaction.channel.send({
        content: `🔒 Ticket fechado por ${interaction.user}\n📝 **Motivo:** ${reason}`,
        embeds: [embed]
    });

    // Renomear canal e agendar arquivamento
    await interaction.channel.setName(`closed-${interaction.channel.name}`);
    setTimeout(() => {
        interaction.channel.delete()
            .catch(console.error);
    }, 5000);

    await interaction.editReply({
        content: '✅ Ticket fechado com sucesso!',
        ephemeral: true
    });
}
