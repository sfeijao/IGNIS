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
const WebhookManager = require('./webhooks/webhookManager');
const logger = require('./logger');

class TicketManager {
    constructor(client) {
        this.client = client;
        this.storage = client.storage;
        this.timeout = new TicketTimeout(client);
        this.notifications = new NotificationManager(client);
        this.webhooks = new WebhookManager();
    }

    // Enviar logs usando o sistema organizados
    async enviarLogOrganizado(guildId, tipo, dados) {
        try {
            logger.info(`🔍 [DEBUG] Tentando enviar log organizado - Guild: ${guildId}, Tipo: ${tipo}`);
            
            const config = await this.storage.getGuildConfig(guildId);
            const logsOrganizados = config?.logsOrganizados;

            logger.info(`🔍 [DEBUG] Config encontrada: ${!!config}, logsOrganizados: ${!!logsOrganizados}`);

            if (!logsOrganizados) {
                logger.info(`🔍 [DEBUG] Sem logs organizados, usando sistema antigo`);
                // Fallback para sistema antigo
                await this.webhooks.sendTicketLog(guildId, tipo, dados);
                return;
            }

            // Determinar qual servidor é baseado no guildId
            let servidorOrigem = null;
            if (guildId === '1333820000791691284') {
                servidorOrigem = 'ysnm';
            } else if (guildId === '1283603691538088027') {
                servidorOrigem = 'beanny';
            }

            logger.info(`🔍 [DEBUG] Servidor origem detectado: ${servidorOrigem}`);
            logger.info(`🔍 [DEBUG] Config para servidor: ${!!logsOrganizados[servidorOrigem]}`);

            if (!servidorOrigem || !logsOrganizados[servidorOrigem]) {
                logger.info(`🔍 [DEBUG] Servidor não configurado, usando sistema antigo`);
                // Fallback para sistema antigo
                await this.webhooks.sendTicketLog(guildId, tipo, dados);
                return;
            }

            const logConfig = logsOrganizados[servidorOrigem];
            logger.info(`🔍 [DEBUG] Config do log: ${JSON.stringify(logConfig)}`);
            
            const { WebhookClient } = require('discord.js');
            const webhook = new WebhookClient({ url: logConfig.webhookUrl });

            // Criar embed baseado no tipo
            const embed = this.criarEmbedLog(tipo, dados, servidorOrigem);

            // Configurar mensagem do webhook
            const webhookData = {
                embeds: [embed],
                username: `${servidorOrigem.toUpperCase()} Tickets`,
                avatarURL: dados.guild?.iconURL?.() || undefined
            };

            // Adicionar arquivos se fornecidos (para transcrições)
            if (dados.files && dados.files.length > 0) {
                webhookData.files = dados.files.map(file => ({
                    attachment: Buffer.from(file.content),
                    name: file.name
                }));
            }

            logger.info(`🔍 [DEBUG] Enviando webhook para: ${logConfig.webhookUrl}`);
            await webhook.send(webhookData);

            logger.info(`📋 Log organizado enviado: ${tipo} para ${servidorOrigem.toUpperCase()}`);

        } catch (error) {
            logger.error('Erro ao enviar log organizado:', error);
            // Fallback para sistema antigo em caso de erro
            await this.webhooks.sendTicketLog(guildId, tipo, dados).catch(() => {});
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
                    .setDescription(`Ticket criado por ${dados.author.tag}`)
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
                    .setDescription(`Ticket reclamado por ${dados.updatedBy.tag}`)
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
                    .setDescription(`Ticket encerrado por ${dados.closedBy.tag}`)
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
                { name: 'Criado por', value: String(user.tag || user.username || 'Desconhecido'), inline: true },
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
                    ephemeral: true
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

            // Send webhook log
            await this.enviarLogOrganizado(interaction.guildId, 'create', {
                author: interaction.user,
                ticketId: ticket.id,
                category: type,
                guild: interaction.guild
            });

            await interaction.editReply({
                content: `✅ Seu ticket foi criado: ${channel}`,
                ephemeral: true
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
                    ephemeral: true
                });
                return;
            }

            if (ticket.assigned_to) {
                await interaction.editReply({
                    content: `❌ Este ticket já está sendo atendido por <@${ticket.assigned_to}>`,
                    ephemeral: true
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
            await this.enviarLogOrganizado(interaction.guildId, 'update', {
                ticketId: ticket.id,
                updatedBy: interaction.user,
                status: 'Atendimento iniciado',
                guild: interaction.guild
            });

            // Update channel message
            const embed = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle('🎫 Ticket em Atendimento')
                .setDescription(`Ticket sendo atendido por ${interaction.user.tag}`)
                .addFields(
                    { name: 'ID do Ticket', value: String(ticket.id || Date.now()), inline: true },
                    { name: 'Status', value: 'Em atendimento', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({
                content: `✅ Você assumiu o atendimento deste ticket.`,
                ephemeral: true
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
                    ephemeral: true
                });
                return;
            }

            // Get messages for transcript
            const messages = await interaction.channel.messages.fetch();
            const transcript = Array.from(messages.values())
                .reverse()
                .map(msg => {
                    const time = msg.createdAt.toLocaleString();
                    const author = msg.author.tag;
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

            // Send webhook log with transcript
            await this.enviarLogOrganizado(interaction.guildId, 'close', {
                author: interaction.user,
                ticketId: ticket.id,
                files: [{
                    name: `ticket-${ticket.id}-transcript.txt`,
                    content: transcript
                }],
                guild: interaction.guild,
                closedBy: interaction.user
            });

            // Notify the user
            try {
                const ticketOwner = await this.client.users.fetch(ticket.user_id);
                if (transcript && transcript.length > 0) {
                    await ticketOwner.send({
                        content: `Seu ticket foi fechado por ${interaction.user.tag}.`,
                        files: [{
                            attachment: Buffer.from(transcript, 'utf8'),
                            name: `ticket-${ticket.id}-transcript.txt`
                        }]
                    });
                } else {
                    await ticketOwner.send({
                        content: `Seu ticket foi fechado por ${interaction.user.tag}.`
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
