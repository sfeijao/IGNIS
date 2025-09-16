const { 
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageFlags
} = require('discord.js');
const { 
    ticketTypes, 
    ticketPriorities, 
    ticketStatus 
} = require('../constants/ticketConstants');
const TicketTimeout = require('./ticketTimeout');
const NotificationManager = require('./notificationManager');
const RobustWebhookManager = require('./RobustWebhookManager');
const TicketIdManager = require('./TicketIdManager');
const { getUserDisplayName } = require('./userHelper');
const logger = require('./logger');

class TicketManager {
    constructor(client) {
        this.client = client;
        this.storage = client.storage;
        this.timeout = new TicketTimeout(client);
        this.notifications = new NotificationManager(client);
        this.webhooks = new RobustWebhookManager();
        this.ticketIdManager = new TicketIdManager();
    }

    // Sistema robusto de logs
    async enviarLog(guildId, tipo, dados) {
        try {
            logger.info(`📨 Enviando log: ${tipo} para guild ${guildId}`);
            
            // Mapear tipos antigos para novos
            let logType = tipo;
            if (tipo === 'create') logType = 'ticket_create';
            if (tipo === 'update' || tipo === 'claim') logType = 'ticket_claim';
            if (tipo === 'close') logType = 'ticket_close';
            
            const resultado = await this.webhooks.sendLog(guildId, logType, dados);
            
            if (resultado.success) {
                logger.info(`✅ Log '${logType}' enviado com sucesso`);
            } else {
                logger.warn(`⚠️ Log '${logType}' não enviado: ${resultado.reason || resultado.error}`);
            }
            
            return resultado.success;
            
        } catch (error) {
            logger.error('❌ Erro ao enviar log:', error);
            return false;
        }
    }

    calculateDuration(startTime) {
        try {
            const start = new Date(startTime);
            const end = new Date();
            const diffMs = end - start;
            
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            
            if (hours > 0) {
                return `${hours}h ${minutes}m`;
            } else {
                return `${minutes}m`;
            }
        } catch {
            return 'N/A';
        }
    }

    criarEmbedLog(tipo, dados, servidorOrigem) {
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setTimestamp()
            .setFooter({ text: `${servidorOrigem.toUpperCase()} Ticket System` });

        switch (tipo) {
            case 'create':
                embed
                    .setTitle('🎫 Novo Ticket Criado')
                    .setColor(0x4CAF50)
                    .setDescription(`Ticket criado por ${getUserDisplayName(dados.author, dados.guild)}`)
                    .addFields(
                        { name: '🆔 ID', value: dados.ticketId, inline: true },
                        { name: '📁 Categoria', value: dados.category || 'N/A', inline: true },
                        { name: '🏷️ Servidor', value: servidorOrigem.toUpperCase(), inline: true }
                    );
                
                if (dados.author.avatarURL) {
                    embed.setThumbnail(dados.author.avatarURL());
                }
                break;

            case 'update':
                embed
                    .setTitle('📝 Ticket Atualizado')
                    .setColor(0xFF9800)
                    .setDescription(`Ticket reclamado por ${getUserDisplayName(dados.updatedBy, dados.guild)}`)
                    .addFields(
                        { name: '🆔 ID', value: dados.ticketId, inline: true },
                        { name: '📊 Status', value: dados.status, inline: true },
                        { name: '🏷️ Servidor', value: servidorOrigem.toUpperCase(), inline: true }
                    );
                break;

            case 'close':
                embed
                    .setTitle('🔒 Ticket Fechado')
                    .setColor(0xF44336)
                    .setDescription(`Ticket encerrado por ${getUserDisplayName(dados.closedBy, dados.guild)}`)
                    .addFields(
                        { name: '🆔 ID', value: dados.ticketId, inline: true },
                        { name: '⏱️ Duração', value: dados.duration || 'N/A', inline: true },
                        { name: '🏷️ Servidor', value: servidorOrigem.toUpperCase(), inline: true },
                        { name: '📝 Motivo', value: dados.reason || 'Não especificado' }
                    );

                if (dados.files && dados.files.length > 0) {
                    embed.addFields({ name: '📋 Transcrição', value: 'Anexada como arquivo', inline: true });
                }
                break;
        }

        return embed;
    }

    async createTicketChannel(guild, user, ticket) {
        const channelName = `ticket-${ticket.id}`;

        // Encontrar categoria para tickets (procura com nomes diferentes)
        let ticketCategory = guild.channels.cache.find(c => 
            c.type === ChannelType.GuildCategory && 
            (c.name === 'Tickets' || c.name === '🎫 Tickets' || c.name === 'TICKETS' || c.name === '📁 TICKETS')
        );

        if (!ticketCategory) {
            // Criar categoria se não existir (com timeout para evitar duplicação)
            try {
                ticketCategory = await guild.channels.create({
                    name: '📁 TICKETS',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        }
                    ]
                });
                logger.info(`Categoria criada com sucesso: ${ticketCategory.name}`);
            } catch (error) {
                // Se falhar, tenta encontrar novamente (pode ter sido criada por outra instância)
                ticketCategory = guild.channels.cache.find(c => 
                    c.type === ChannelType.GuildCategory && 
                    (c.name === 'Tickets' || c.name === '🎫 Tickets' || c.name === 'TICKETS' || c.name === '📁 TICKETS')
                );
                if (!ticketCategory) {
                    throw new Error(`Falha ao criar categoria de tickets: ${error.message}`);
                }
                logger.warn('Categoria criada por outra instância, usando existente');
            }
        }

        // Create channel with proper permissions
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: ticketCategory.id,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                }
            ]
        });

        // Send initial message in the channel
        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('🎫 Ticket Criado')
            .setDescription('Aguarde um membro da equipe responder.\nDescreva seu problema com detalhes.')
            .addFields(
                { name: 'Criado por', value: String(getUserDisplayName(user, guild) || 'Desconhecido'), inline: true },
                { name: 'ID do Ticket', value: String(ticket.id || Date.now()), inline: true },
                { name: 'Categoria', value: String(ticket.type || 'Geral'), inline: true }
            )
            .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('Fechar Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒'),
            new ButtonBuilder()
                .setCustomId('ticket_claim')
                .setLabel('Atender Ticket')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✋')
        );

        await channel.send({
            content: `<@${user.id}> seu ticket foi criado!`,
            embeds: [embed],
            components: [buttons]
        });

        return channel;
    }

    async handleTicketCreate(interaction, type, description) {
        try {
            // Get existing tickets
            const existingTickets = await this.storage.getTickets(interaction.guildId);
            
            // Check for existing open tickets
            const userTickets = existingTickets.filter(t => 
                t.user_id === interaction.user.id && 
                ['open', 'assigned'].includes(t.status)
            );

            if (userTickets.length > 0) {
                const ticket = userTickets[0];
                await interaction.editReply({
                    content: `❌ Você já tem um ticket aberto: <#${ticket.channel_id}>`,
                    flags: MessageFlags.Ephemeral
                });
                return null;
            }

            // Create ticket data with all necessary fields
            const ticketData = {
                guild_id: interaction.guildId,
                user_id: interaction.user.id,
                type: type,
                description: description,
                status: 'open',
                created_at: new Date().toISOString(),
                priority: 'normal',
                channel_id: null // será atualizado após criar o canal
            };

            // Create ticket first
            const ticket = await this.storage.createTicket(ticketData);
            if (!ticket || !ticket.id) {
                throw new Error('Falha ao criar ticket no banco de dados');
            }

            // Create channel for the ticket
            const channel = await this.createTicketChannel(interaction.guild, interaction.user, ticket);
            if (!channel || !channel.id) {
                // Se falhar na criação do canal, remova o ticket do banco de dados
                await this.storage.deleteTicket(ticket.id).catch(err => logger.error('Erro ao deletar ticket após falha na criação do canal:', err));
                throw new Error('Falha ao criar canal do ticket');
            }

            // Update ticket with channel id
            ticket.channel_id = channel.id;
            await this.storage.updateTicket(ticket.id, { channel_id: channel.id });

            // 🎫 REGISTRAR ID SEQUENCIAL DO TICKET
            const sequentialId = await this.ticketIdManager.registerTicket(
                interaction.guildId, 
                channel.id, 
                interaction.user.id
            );
            
            logger.info(`🎫 Ticket criado: ID sequencial ${sequentialId} para canal ${channel.id}`);

            // Send webhook log
            await this.enviarLog(interaction.guildId, 'create', {
                author: interaction.user,
                ticketId: ticket.id,
                sequentialId: sequentialId,
                category: type,
                guild: interaction.guild
            });

            await interaction.editReply({
                content: `✅ Seu ticket foi criado: ${channel}`,
                flags: MessageFlags.Ephemeral
            });

            return ticket;
        } catch (error) {
            logger.error('Erro ao criar ou atualizar ticket:', error);
            throw error;
        }
    }

    async handleTicketClaim(interaction) {
        try {
            const ticket = await this.storage.getTicketByChannel(interaction.channelId);
            if (!ticket) {
                await interaction.editReply({
                    content: '❌ Este não é um canal de ticket válido.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (ticket.assigned_to) {
                await interaction.editReply({
                    content: `❌ Este ticket já está sendo atendido por <@${ticket.assigned_to}>`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Update ticket
            await this.storage.updateTicket(ticket.id, {
                status: 'assigned',
                assigned_to: interaction.user.id,
                last_activity: new Date().toISOString()
            });

            // Send webhook log
            await this.enviarLog(interaction.guildId, 'update', {
                ticketId: ticket.id,
                author: await this.client.users.fetch(ticket.user_id).catch(() => null),
                claimedBy: interaction.user,
                guild: interaction.guild
            });

            // Update channel message
            const embed = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle('🎫 Ticket em Atendimento')
                .setDescription(`Ticket sendo atendido por ${getUserDisplayName(interaction.user, interaction.guild)}`)
                .addFields(
                    { name: 'ID do Ticket', value: String(ticket.id || Date.now()), inline: true },
                    { name: 'Status', value: 'Em atendimento', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({
                content: `✅ Você assumiu o atendimento deste ticket.`,
                flags: MessageFlags.Ephemeral
            });

            await interaction.channel.send({
                content: `📝 Ticket assumido por ${interaction.user}`,
                embeds: [embed]
            });

            return ticket;
        } catch (error) {
            logger.error('Error claiming ticket:', error);
            throw error;
        }
    }

    async handleTicketClose(interaction) {
        try {
            const ticket = await this.storage.getTicketByChannel(interaction.channelId);
            if (!ticket) {
                await interaction.editReply({
                    content: '❌ Este não é um canal de ticket válido.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Get messages for transcript
            const messages = await interaction.channel.messages.fetch();
            const transcript = Array.from(messages.values())
                .reverse()
                .map(msg => {
                    const time = msg.createdAt.toLocaleString();
                    const author = getUserDisplayName(msg.author, interaction.guild);
                    const content = msg.content || '[Sem conteúdo]';
                    
                    let attachments = '';
                    if (msg.attachments.size > 0) {
                        attachments = '\nAnexos:\n' + 
                            Array.from(msg.attachments.values())
                                .map(a => `- ${a.url}`)
                                .join('\n');
                    }

                    return `[${time}] ${author}: ${content}${attachments}\n`;
                })
                .join('\n');

            // Close the ticket
            await this.storage.updateTicket(ticket.id, {
                status: 'closed',
                closed_at: new Date().toISOString(),
                closed_by: interaction.user.id,
                last_activity: new Date().toISOString()
            });

            // 🎫 OBTER ID SEQUENCIAL DO TICKET
            const ticketInfo = await this.ticketIdManager.getTicketByChannel(interaction.channelId);
            const sequentialId = ticketInfo ? ticketInfo.sequentialId : 'N/A';

            // Send webhook log with transcript
            await this.enviarLog(interaction.guildId, 'close', {
                ticketId: ticket.id,
                sequentialId: sequentialId,
                channelId: interaction.channelId,
                author: await this.client.users.fetch(ticket.user_id).catch(() => null),
                claimedBy: ticket.assigned_to ? await this.client.users.fetch(ticket.assigned_to).catch(() => null) : null,
                closedBy: interaction.user,
                transcript: transcript,
                guild: interaction.guild,
                duration: this.calculateDuration(ticket.created_at),
                reason: 'Ticket resolvido'
            });

            // Notify the user with enhanced transcript
            try {
                const ticketOwner = await this.client.users.fetch(ticket.user_id);
                
                if (transcript && transcript.length > 0) {
                    // Criar transcript melhorado com informações do servidor
                    const enhancedTranscript = `🎫 TRANSCRIÇÃO DO TICKET
========================================
🏷️ Servidor: ${interaction.guild.name}
🆔 ID do Servidor: ${interaction.guild.id}
📍 Canal: #${interaction.channel.name}
🆔 ID do Canal: ${interaction.channel.id}
👤 Fechado por: ${getUserDisplayName(interaction.user, interaction.guild)}
⏰ Data de Fechamento: ${new Date().toLocaleString('pt-BR')}
========================================

${transcript}

========================================
Fim da transcrição - Ticket resolvido
========================================`;

                    await ticketOwner.send({
                        content: `🔒 **SEU TICKET FOI FECHADO**

📋 **Informações do Ticket:**
• **Servidor:** ${interaction.guild.name}
• **Canal:** #${interaction.channel.name}
• **Fechado por:** ${getUserDisplayName(interaction.user, interaction.guild)}
• **Data:** ${new Date().toLocaleString('pt-BR')}

📎 A transcrição completa está anexada abaixo.`,
                        files: [{
                            attachment: Buffer.from(enhancedTranscript, 'utf8'),
                            name: `ticket-${ticket.id}-${interaction.guild.name.replace(/[^a-zA-Z0-9]/g, '_')}-transcript.txt`
                        }]
                    });
                } else {
                    await ticketOwner.send({
                        content: `🔒 **SEU TICKET FOI FECHADO**

📋 **Informações do Ticket:**
• **Servidor:** ${interaction.guild.name}
• **Canal:** #${interaction.channel.name}
• **Fechado por:** ${getUserDisplayName(interaction.user, interaction.guild)}
• **Data:** ${new Date().toLocaleString('pt-BR')}

ℹ️ Não foram encontradas mensagens para gerar transcrição.`
                    });
                }
            } catch (dmError) {
                logger.warn(`Could not DM transcript to user ${ticket.user_id}:`, dmError);
            }

            try {
                // Avisa que o ticket será fechado
                await interaction.editReply({
                    content: '✅ O ticket será fechado em 5 segundos...',
                    flags: MessageFlags.Ephemeral
                });

                // Espera todas as mensagens e logs serem enviados
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Avisa que está fechando
                const closeMsg = await interaction.channel.send('🔒 Fechando ticket...').catch(() => null);

                // Espera a mensagem ser enviada e então deleta o canal
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Deleta o canal
                await interaction.channel.delete().catch(async (deleteError) => {
                    logger.error('Error deleting ticket channel:', deleteError);
                    
                    // Remove a mensagem de fechamento se ela foi enviada
                    if (closeMsg) {
                        await closeMsg.delete().catch(() => {});
                    }

                    // Tenta atualizar a mensagem original
                    await interaction.editReply({
                        content: '❌ Erro ao deletar o canal. Por favor, tente novamente.',
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});

                    throw new Error('Failed to delete channel');
                });
            } catch (error) {
                logger.error('Error in ticket close sequence:', error);
                throw error; // Re-throw para tratamento no handler principal
            }

            return ticket;
        } catch (error) {
            logger.error('Error closing ticket:', error);
            throw error;
        }
    }
}

module.exports = TicketManager;
