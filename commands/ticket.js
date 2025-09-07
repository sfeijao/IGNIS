const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createTicketModal, getTicketTypeInfo } = require('../utils/ticketModals');
const TicketSystem = require('../utils/ticketSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Criar um novo ticket de suporte')
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de ticket')
                .setRequired(true)
                .addChoices(
                    { name: '🛠️ Suporte Técnico', value: 'suporte' },
                    { name: '🚨 Reportar Problema', value: 'problema' },
                    { name: '💡 Sugestão', value: 'sugestao' },
                    { name: '👤 Questão de Moderação', value: 'moderacao' },
                    { name: '📝 Geral', value: 'geral' }
                )
        ),

    async execute(interaction) {
        try {
            const tipo = interaction.options.getString('tipo');
            
            // Verificar se o usuário já tem um ticket aberto
            const storage = interaction.client.storage;
            const userTickets = await storage.getTickets(interaction.guild.id);
            const openTicket = userTickets.find(ticket => 
                ticket.user_id === interaction.user.id && 
                (ticket.status === 'open' || ticket.status === 'assigned')
            );
            
            if (openTicket) {
                return await interaction.reply({
                    content: `❌ Você já tem um ticket aberto: <#${openTicket.channel_id}>`,
                    ephemeral: true
                });
            }
            
            // Criar modal para detalhes do ticket
            const modal = createTicketModal(tipo);
            await interaction.showModal(modal);

        } catch (error) {
            console.error('Erro no comando ticket:', error);
            if (!interaction.replied) {
                await interaction.reply({
                    content: '❌ Erro ao processar comando de ticket.',
                    ephemeral: true
                });
            }
        }
    },

    // Handler para quando o modal é submetido
    async handleModalSubmit(interaction) {
        try {
            const tipo = interaction.customId.split('_')[2];
            const subject = interaction.fields.getTextInputValue('ticket_subject');
            const description = interaction.fields.getTextInputValue('ticket_description');
            
            await interaction.deferReply({ ephemeral: true });
            
            const ticketSystem = new TicketSystem(interaction.client);
            const typeInfo = getTicketTypeInfo(tipo);
            
            // Buscar ou criar categoria de tickets
            const guildConfig = await interaction.client.storage.getGuildConfig(interaction.guild.id);
            const staffRoleId = guildConfig.ticketStaffRoleId;

            if (!staffRoleId) {
                return await interaction.editReply({
                    content: '❌ Sistema de tickets não configurado. Use `/configurar-painel-tickets` primeiro.',
                    ephemeral: true
                });
            }

            let ticketCategory = interaction.guild.channels.cache.find(
                channel => channel.type === 4 && channel.name.toLowerCase() === 'tickets'
            );
            
            if (!ticketCategory) {
                ticketCategory = await interaction.guild.channels.create({
                    name: 'Tickets',
                    type: 4,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.roles.everyone,
                            deny: ['ViewChannel']
                        },
                        {
                            id: staffRoleId,
                            allow: ['ViewChannel', 'SendMessages', 'ManageChannels']
                        }
                    ]
                });
            }
            
            // Criar canal do ticket
            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${tipo}-${interaction.user.username}`,
                type: 0,
                parent: ticketCategory.id,
                topic: `Ticket de ${interaction.user.tag} | Tipo: ${typeInfo.name}`,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone,
                        deny: ['ViewChannel']
                    },
                    {
                        id: interaction.user.id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
                    },
                    {
                        id: staffRoleId,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
                    }
                ]
            });
            
            // Criar ticket na base de dados
            const ticketData = {
                guild_id: interaction.guild.id,
                channel_id: ticketChannel.id,
                user_id: interaction.user.id,
                category: tipo,
                subject: subject,
                description: description,
                priority: 'normal'
            };
            
            const ticket = await interaction.client.storage.createTicket(ticketData);
            
            // Criar embed e botões
            const embed = new EmbedBuilder()
                .setColor(typeInfo.color)
                .setTitle(`🎫 Ticket #${ticket.id} - ${typeInfo.name}`)
                .setDescription(`**Assunto:** ${subject}`)
                .addFields(
                    { name: '📝 Descrição', value: description, inline: false },
                    { name: '👤 Autor', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📅 Criado em', value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true }
                )
                .setFooter({ text: 'YSNM Ticket System', iconURL: interaction.guild.iconURL() });

            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ticket_assign_${ticket.id}`)
                        .setLabel('Atribuir para mim')
                        .setStyle('Primary')
                        .setEmoji('👋'),
                    new ButtonBuilder()
                        .setCustomId(`ticket_close_${ticket.id}`)
                        .setLabel('Fechar Ticket')
                        .setStyle('Danger')
                        .setEmoji('🔒')
                );

            await ticketChannel.send({ 
                content: `<@${interaction.user.id}> Seu ticket foi criado!\n<@&${staffRoleId}> Novo ticket disponível.`,
                embeds: [embed],
                components: [actionRow]
            });

            // Enviar log via webhook
            await ticketSystem.sendLogWebhook(interaction.guild, ticket, 'create');

            await interaction.editReply({
                content: `✅ Ticket criado com sucesso em ${ticketChannel}!`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Erro ao criar ticket:', error);
            await interaction.editReply({
                content: '❌ Erro ao criar ticket. Por favor, tente novamente.',
                ephemeral: true
            });
        }
    }
};
        .addStringOption(option =>
            option.setName('prioridade')
                .setDescription('Prioridade do ticket')
                .setRequired(false)
                .addChoices(
                    { name: '🔴 Urgente', value: 'urgent' },
                    { name: '🟠 Alta', value: 'high' },
                    { name: '🟡 Normal', value: 'normal' },
                    { name: '🟢 Baixa', value: 'low' }
                )
        ),

    async execute(interaction) {
        try {
            const tipo = interaction.options.getString('tipo');
            
            // Verificar se o usuário já tem um ticket aberto
            const storage = interaction.client.storage;
            const userTickets = await storage.getTickets(interaction.guild.id);
            const openTicket = userTickets.find(ticket => 
                ticket.user_id === interaction.user.id && 
                (ticket.status === 'open' || ticket.status === 'assigned')
            );
            
            if (openTicket) {
                return await interaction.reply({
                    content: `❌ Você já tem um ticket aberto: <#${openTicket.channel_id}>`,
                    ephemeral: true
                });
            }
            
            // Criar modal para detalhes do ticket
            const modal = createTicketModal(tipo);

            const subjectInput = new TextInputBuilder()
                .setCustomId('ticket_subject')
                .setLabel('Assunto do Ticket')
                .setStyle(TextInputStyle.Short)
                .setMinLength(5)
                .setMaxLength(100)
                .setPlaceholder('Descreva brevemente o problema...')
                .setRequired(true);

            const descriptionInput = new TextInputBuilder()
                .setCustomId('ticket_description')
                .setLabel('Descrição Detalhada')
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(10)
                .setMaxLength(1000)
                .setPlaceholder('Explica o problema em detalhe, passos para reproduzir, etc...')
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(subjectInput);
            const secondActionRow = new ActionRowBuilder().addComponents(descriptionInput);

            modal.addComponents(firstActionRow, secondActionRow);

            await interaction.showModal(modal);

        } catch (error) {
            console.error('Erro no comando ticket:', error);
            if (!interaction.replied) {
                await interaction.reply({
                    content: '❌ Erro ao processar comando de ticket.',
                    ephemeral: true
                });
            }
        }
    },

    // Handler para quando o modal é submetido
    async handleModalSubmit(interaction) {
        try {
            const tipo = interaction.customId.split('_')[2];
            const subject = interaction.fields.getTextInputValue('ticket_subject');
            const description = interaction.fields.getTextInputValue('ticket_description');
            
            await interaction.deferReply({ ephemeral: true });
            
            const ticketSystem = new TicketSystem(interaction.client);
            const typeInfo = getTicketTypeInfo(tipo);
            
            // Buscar categoria de tickets (ou criar se não existir)
            let ticketCategory = interaction.guild.channels.cache.find(
                channel => channel.type === 4 && channel.name.toLowerCase() === 'tickets'
            );
            
            if (!ticketCategory) {
                console.log('📁 Criando categoria de tickets...');
                ticketCategory = await interaction.guild.channels.create({
                    name: 'Tickets',
                    type: 4, // Category
                    permissionOverwrites: [
                        {
                            id: interaction.guild.roles.everyone,
                            deny: ['ViewChannel']
                        }
                    ]
                });
            }
            
            // Criar canal do ticket
            const ticketChannelName = `ticket-${interaction.user.username}-${Date.now().toString().slice(-6)}`;
            console.log('🎫 Criando canal:', ticketChannelName);
            
            const ticketChannel = await interaction.guild.channels.create({
                name: ticketChannelName,
                type: 0, // Text channel
                parent: ticketCategory.id,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone,
                        deny: ['ViewChannel']
                    },
                    {
                        id: interaction.user.id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
                    },
                    // Permitir que moderadores vejam
                    ...interaction.guild.roles.cache
                        .filter(role => role.permissions.has('ManageMessages'))
                        .map(role => ({
                            id: role.id,
                            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
                        }))
                ]
            });
            
            // Criar ticket na base de dados
            const storage = interaction.client.storage;
            
            const ticketData = {
                guild_id: interaction.guild.id,
                channel_id: ticketChannel.id,
                user_id: interaction.user.id,
                category: tipo,
                subject: subject,
                description: description,
                priority: prioridade
            };
            
            const ticketResult = await storage.createTicket(ticketData);
            
            // Criar embed informativo
            const embed = new EmbedBuilder()
                .setColor(getPriorityColor(prioridade))
                .setTitle(`🎫 Ticket #${ticketResult.id}`)
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: '📝 Assunto', value: subject, inline: true },
                    { name: '🏷️ Tipo', value: `${getTipoEmoji(tipo)} ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`, inline: true },
                    { name: '⚡ Prioridade', value: `${getPriorityEmoji(prioridade)} ${prioridade.toUpperCase()}`, inline: true },
                    { name: '📄 Descrição', value: description.length > 500 ? description.substring(0, 500) + '...' : description, inline: false },
                    { name: '👤 Criado por', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '🕒 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                )
                .setFooter({ text: 'Sistema de Tickets YSNM', iconURL: interaction.guild.iconURL() })
                .setTimestamp();
            
            // Criar botões de ação
            const { ButtonBuilder, ButtonStyle } = require('discord.js');
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Success)
                        .setLabel('Atribuir-me')
                        .setCustomId(`ticket_assign_${ticketResult.id}`)
                        .setEmoji('👋'),
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Danger)
                        .setLabel('Fechar Ticket')
                        .setCustomId(`ticket_close_${ticketResult.id}`)
                        .setEmoji('🔒')
                );
            
            // Enviar mensagem no canal do ticket
            await ticketChannel.send({
                content: `<@${interaction.user.id}> O seu ticket foi criado com sucesso!\n\n**Staff:** Use os botões abaixo para gerir este ticket.`,
                embeds: [embed],
                components: [actionRow]
            });
            
            // Responder ao usuário
            await interaction.editReply({
                content: `✅ Ticket criado com sucesso!\n🎫 **Canal:** ${ticketChannel}\n📋 **ID:** #${ticketResult.id}`,
            });
            
            console.log(`✅ Ticket #${ticketResult.id} criado com sucesso por ${interaction.user.tag}`);
            
        } catch (error) {
            console.error('Erro ao criar ticket:', error);
            await interaction.editReply({
                content: '❌ Erro ao criar ticket. Tenta novamente ou contacta um administrador.'
            });
        }
    },

    // Função para criar ticket a partir do painel
    async createTicketFromPanel(interaction, ticketData) {
        const { tipo, subject, description, priority } = ticketData;
        
        // Buscar categoria de tickets (ou criar se não existir)
        let ticketCategory = interaction.guild.channels.cache.find(
            channel => channel.type === 4 && channel.name.toLowerCase() === 'tickets'
        );
        
        if (!ticketCategory) {
            console.log('📁 Criando categoria de tickets...');
            ticketCategory = await interaction.guild.channels.create({
                name: 'Tickets',
                type: 4, // Category
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone,
                        deny: ['ViewChannel']
                    }
                ]
            });
        }
        
        // Criar canal do ticket
        const ticketChannelName = `ticket-${interaction.user.username}-${Date.now().toString().slice(-6)}`;
        console.log('🎫 Criando canal:', ticketChannelName);
        
        const ticketChannel = await interaction.guild.channels.create({
            name: ticketChannelName,
            type: 0, // Text channel
            parent: ticketCategory.id,
            topic: `Ticket de ${interaction.user.tag} (${interaction.user.id}) - Tipo: ${tipo}`,
            permissionOverwrites: [
                {
                    id: interaction.guild.roles.everyone,
                    deny: ['ViewChannel']
                },
                {
                    id: interaction.user.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
                },
                // Permitir que moderadores vejam
                ...interaction.guild.roles.cache
                    .filter(role => role.permissions.has('ManageMessages'))
                    .map(role => ({
                        id: role.id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
                    }))
            ]
        });
        
        // Criar ticket na base de dados
        const storage = interaction.client.storage;
        
        const ticketDBData = {
            guild_id: interaction.guild.id,
            channel_id: ticketChannel.id,
            user_id: interaction.user.id,
            category: tipo,
            subject: subject,
            description: description,
            priority: priority
        };
        
        const ticketResult = await storage.createTicket(ticketDBData);
        
        // Criar embed informativo
        const embed = new EmbedBuilder()
            .setColor(getPriorityColor(priority))
            .setTitle(`🎫 Ticket #${ticketResult.id}`)
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields(
                { name: '📝 Assunto', value: subject, inline: true },
                { name: '🏷️ Tipo', value: `${getTipoEmoji(tipo)} ${getTipoNome(tipo)}`, inline: true },
                { name: '⚡ Prioridade', value: `${getPriorityEmoji(priority)} ${priority.toUpperCase()}`, inline: true },
                { name: '📄 Descrição', value: description.length > 500 ? description.substring(0, 500) + '...' : description, inline: false },
                { name: '👤 Criado por', value: `<@${interaction.user.id}>`, inline: true },
                { name: '🕒 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setFooter({ text: 'Sistema de Tickets YSNM', iconURL: interaction.guild.iconURL() })
            .setTimestamp();
        
        // Criar botões de ação
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Success)
                    .setLabel('Atribuir-me')
                    .setCustomId(`ticket_assign_${ticketResult.id}`)
                    .setEmoji('👋'),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Danger)
                    .setLabel('Fechar Ticket')
                    .setCustomId(`ticket_close_${ticketResult.id}`)
                    .setEmoji('🔒')
            );
        
        // Enviar mensagem no canal do ticket
        await ticketChannel.send({
            content: `<@${interaction.user.id}> O seu ticket foi criado com sucesso!\n\n**Staff:** Use os botões abaixo para gerir este ticket.`,
            embeds: [embed],
            components: [actionRow]
        });
        
        // Responder ao usuário
        await interaction.editReply({
            content: `✅ Ticket criado com sucesso!\n🎫 **Canal:** ${ticketChannel}\n📋 **ID:** #${ticketResult.id}`,
        });
        
        console.log(`✅ Ticket #${ticketResult.id} criado com sucesso por ${interaction.user.tag} via painel`);
    }
};

// Funções auxiliares para o sistema de tickets
function getTipoEmoji(tipo) {
    const emojis = {
        'suporte': '🛠️',
        'problema': '🚨',
        'sugestao': '💡',
        'moderacao': '👤',
        'geral': '📝'
    };
    return emojis[tipo] || '📝';
}

function getTipoNome(tipo) {
    const nomes = {
        'suporte': 'Suporte Técnico',
        'problema': 'Reportar Problema',
        'sugestao': 'Sugestão',
        'moderacao': 'Moderação',
        'geral': 'Geral'
    };
    return nomes[tipo] || 'Geral';
}

function getPriorityEmoji(priority) {
    const emojis = {
        'urgent': '🔴',
        'high': '🟠',
        'normal': '🟡',
        'low': '🟢'
    };
    return emojis[priority] || '🟡';
}

function getPriorityColor(priority) {
    const colors = {
        'urgent': 0xFF0000,
        'high': 0xFF8000,
        'normal': 0xFFFF00,
        'low': 0x00FF00
    };
    return colors[priority] || 0xFFFF00;
}
