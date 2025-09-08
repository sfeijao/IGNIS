const { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');

function createTicketModal(type) {
    const modal = new ModalBuilder()
        .setCustomId(`ticket_create_modal_${type}`)
        .setTitle('📝 Criar Novo Ticket');

    const titleInput = new TextInputBuilder()
        .setCustomId('ticket_title')
        .setLabel('Título do Ticket')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Problema com comando, Dúvida sobre configuração...')
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(100);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('ticket_description')
        .setLabel('Descrição do Problema')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Descreva seu problema ou dúvida em detalhes...')
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1000);

    const firstRow = new ActionRowBuilder().addComponents(titleInput);
    const secondRow = new ActionRowBuilder().addComponents(descriptionInput);

    modal.addComponents(firstRow, secondRow);
    return modal;
}

async function handleTicketCreation(interaction, type) {
    const title = interaction.fields.getTextInputValue('ticket_title');
    const description = interaction.fields.getTextInputValue('ticket_description');

    // Defer a resposta para evitar timeout
    await interaction.deferReply({ ephemeral: true });

    try {
        const guild = interaction.guild;

        // Criar canal do ticket
        const channel = await guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: guild.channels.cache.find(c => c.name.toLowerCase().includes('ticket'))?.id,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                },
                {
                    id: interaction.client.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageChannels
                    ]
                }
            ]
        });

        // Obter configurações do servidor
        const storage = require('../utils/storage');
        const guildConfig = await storage.getGuildConfig(guild.id) || {};
        
        // Se houver cargo de staff, dar acesso ao canal
        if (guildConfig.ticketStaffRoleId) {
            await channel.permissionOverwrites.create(guildConfig.ticketStaffRoleId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
        }

        // Criar ticket no banco de dados
        const TicketManager = require('../utils/ticketManager');
        const ticketManager = new TicketManager(interaction.client);
        
        const ticketData = {
            subject: title,
            description: description,
            category: type,
            priority: 'normal'
        };

        const ticket = await ticketManager.createTicket(
            guild.id,
            interaction.user.id,
            channel.id,
            ticketData
        );

        // Enviar mensagem inicial no canal
        const embed = {
            color: 0x2f3136,
            title: `🎫 Ticket: ${title}`,
            description: description,
            fields: [
                { name: '👤 Criado por', value: `${interaction.user}`, inline: true },
                { name: '📂 Categoria', value: type, inline: true },
                { name: '🕐 Criado em', value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true }
            ],
            footer: { text: `ID do Ticket: ${ticket.id}` }
        };

        const buttons = new ActionRowBuilder()
            .addComponents(
                // Botão de fechar ticket
                require('discord.js').ButtonBuilder.from({
                    custom_id: `ticket_close_${ticket.id}`,
                    label: 'Fechar Ticket',
                    style: 4, // Danger
                    emoji: '🔒'
                }),
                // Botão de atribuir ticket
                require('discord.js').ButtonBuilder.from({
                    custom_id: `ticket_assign_${ticket.id}`,
                    label: 'Atribuir para mim',
                    style: 1, // Primary
                    emoji: '👋'
                })
            );

        await channel.send({ 
            content: `${interaction.user} Seu ticket foi criado! A equipe irá te atender em breve.`,
            embeds: [embed],
            components: [buttons]
        });

        // Responder ao usuário
        await interaction.editReply({
            content: `✅ Ticket criado com sucesso! Acesse: ${channel}`,
            ephemeral: true
        });

    } catch (error) {
        console.error('Erro ao criar ticket:', error);
        await interaction.editReply({
            content: '❌ Ocorreu um erro ao criar o ticket. Por favor, tente novamente.',
            ephemeral: true
        });
    }
}

module.exports = {
    createTicketModal,
    handleTicketCreation
};
