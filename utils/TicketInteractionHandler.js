const { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    PermissionFlagsBits 
} = require('discord.js');
const TicketDatabase = require('./TicketDatabase');
const TicketEmbedManager = require('./TicketEmbedManager');
const TicketComponentManager = require('./TicketComponentManager');
const RobustWebhookManager = require('./RobustWebhookManager');
const TicketPermissionManager = require('./TicketPermissionManager');
const { getUserDisplayName } = require('./userHelper');
const logger = require('./logger');

class TicketInteractionHandler {
    constructor(client) {
        this.client = client;
        this.database = new TicketDatabase();
        this.embedManager = new TicketEmbedManager(client);
        this.componentManager = new TicketComponentManager();
        this.webhookManager = new RobustWebhookManager();
        this.permissionManager = new TicketPermissionManager();
        
        // Cache de auto-detecção por servidor
        this.staffRoleCache = new Map();
        
        // Configuração de escalação
        this.escalationLevels = [
            {
                name: 'Supervisor',
                roleId: null, // Será detectado automaticamente
                description: 'Supervisor de suporte'
            },
            {
                name: 'Manager',
                roleId: null, // Será detectado automaticamente
                description: 'Manager da equipa'
            }
        ];
    }

    // Handler principal para todas as interações de tickets
    async handleTicketInteraction(interaction) {
        if (!interaction.customId || !interaction.customId.startsWith('ticket:')) {
            return false;
        }

        // Auto-configurar cargos de staff na primeira interação
        await this.ensureStaffRolesConfigured(interaction.guild);

        const parts = interaction.customId.split(':');
        const action = parts[1];
        const ticketId = parts[2];

        // Verificar se o ticket existe (para ações que precisam)
        let ticket = null;
        if (ticketId && !['create'].includes(action)) {
            ticket = this.database.getTicket(ticketId);
            if (!ticket) {
                return await interaction.reply({
                    content: '❌ Ticket não encontrado ou já foi removido.',
                    ephemeral: true
                });
            }
        }

        // Verificar permissões
        const isStaff = this.isStaff(interaction.member);
        const isOwner = ticket ? ticket.ownerId === interaction.user.id : false;

        try {
            switch (action) {
                case 'claim':
                    return await this.handleClaim(interaction, ticket, isStaff);
                
                case 'close':
                    return await this.handleClose(interaction, ticket, isStaff, isOwner);
                
                case 'transfer':
                    return await this.handleTransfer(interaction, ticket, isStaff);
                
                case 'addnote':
                    return await this.handleAddNote(interaction, ticket, isStaff);
                
                case 'transcript':
                    return await this.handleTranscript(interaction, ticket, isStaff);
                
                case 'escalate':
                    return await this.handleEscalate(interaction, ticket, isStaff);
                
                case 'lock':
                    return await this.handleLock(interaction, ticket, isStaff);
                
                case 'reopen':
                    return await this.handleReopen(interaction, ticket, isStaff, isOwner);
                
                case 'canned':
                    return await this.handleCannedResponse(interaction, ticket, isStaff);
                
                case 'category':
                    return await this.handleCategoryChange(interaction, ticket, isStaff);
                
                case 'escalate-menu':
                    return await this.handleEscalationMenu(interaction, ticket, isStaff);
                
                case 'attach':
                    return await this.handleAttachEvidence(interaction, ticket, isOwner);
                
                case 'create':
                    return await this.handleCreateTicket(interaction, parts[2]);
                
                default:
                    return await interaction.reply({
                        content: '❌ Ação não reconhecida.',
                        ephemeral: true
                    });
            }
        } catch (error) {
            logger.error(`Erro ao processar interação de ticket ${action}:`, error);
            
            if (!interaction.replied && !interaction.deferred) {
                return await interaction.reply({
                    content: '❌ Ocorreu um erro ao processar a ação. Tenta novamente.',
                    ephemeral: true
                });
            }
        }

        return true;
    }

    // Claim ticket (Atender)
    async handleClaim(interaction, ticket, isStaff) {
        if (!isStaff) {
            return await interaction.reply({
                content: '❌ Apenas staff pode atender tickets.',
                ephemeral: true
            });
        }

        if (ticket.claimedBy) {
            const claimedByUser = await this.client.users.fetch(ticket.claimedBy);
            return await interaction.reply({
                content: `❌ Este ticket já está a ser atendido por ${claimedByUser.tag}.`,
                ephemeral: true
            });
        }

        // Atualizar ticket na base de dados
        const updatedTicket = await this.database.claimTicket(ticket.ticketId, interaction.user.id);

        // Atualizar embed
        await this.updateTicketEmbed(interaction, updatedTicket);

        // Mensagem no canal
        await interaction.followUp({
            content: `✅ ${getUserDisplayName(interaction.user, interaction.guild)} assumiu este ticket.`,
            ephemeral: false
        });

        // Atualizar permissões do canal (opcional)
        await this.updateChannelPermissions(interaction.channel, updatedTicket);

        return true;
    }

    // Fechar ticket
    async handleClose(interaction, ticket, isStaff, isOwner) {
        if (!isStaff && !isOwner) {
            return await interaction.reply({
                content: '❌ Apenas staff ou o dono do ticket podem fechá-lo.',
                ephemeral: true
            });
        }

        // Modal para motivo
        const modal = new ModalBuilder()
            .setCustomId(`ticket:close-modal:${ticket.ticketId}`)
            .setTitle('Fechar Ticket');

        const reasonInput = new TextInputBuilder()
            .setCustomId('close-reason')
            .setLabel('Motivo (opcional)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Descreve o motivo do fecho...')
            .setRequired(false)
            .setMaxLength(500);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

        await interaction.showModal(modal);
        return true;
    }

    // Modal de fecho submetido
    async handleCloseModal(interaction, ticketId) {
        const reason = interaction.fields.getTextInputValue('close-reason') || null;
        const ticket = this.database.getTicket(ticketId);

        if (!ticket) {
            return await interaction.reply({
                content: '❌ Ticket não encontrado.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Gerar transcript
            const transcript = await this.generateTranscript(interaction.channel, ticket);
            
            // Fechar ticket na base de dados
            const updatedTicket = await this.database.closeTicket(
                ticket.ticketId, 
                interaction.user.id, 
                reason
            );

            // Adicionar transcript à base de dados
            if (transcript) {
                await this.database.addTranscript(ticket.ticketId, {
                    content: transcript,
                    generatedBy: interaction.user.id
                });
            }

            // Enviar transcript para webhooks
            await this.sendToWebhooks(updatedTicket, transcript, interaction.guild);

            // Enviar transcript por DM ao dono do ticket
            await this.sendTranscriptDM(updatedTicket, transcript, interaction.guild);

            // Atualizar embed para estado fechado
            const owner = await this.client.users.fetch(ticket.ownerId);
            const closedEmbed = this.embedManager.createClosedTicketEmbed(
                updatedTicket, 
                interaction.guild, 
                owner, 
                interaction.user, 
                reason
            );

            const closedComponents = this.componentManager.createClosedTicketComponents(
                ticket.ticketId, 
                true // Pode reabrir
            );

            await interaction.message.edit({
                embeds: [closedEmbed],
                components: closedComponents
            });

            await interaction.editReply({
                content: '✅ Ticket fechado com sucesso! Transcript enviado para logs e DM do utilizador.'
            });

            // Agendar fecho do canal (após 5 minutos)
            setTimeout(() => {
                this.closeChannel(interaction.channel, updatedTicket);
            }, 5 * 60 * 1000);

        } catch (error) {
            logger.error('Erro ao fechar ticket:', error);
            await interaction.editReply({
                content: '❌ Erro ao fechar ticket. Contacta um administrador.'
            });
        }

        return true;
    }

    // Adicionar nota interna
    async handleAddNote(interaction, ticket, isStaff) {
        if (!isStaff) {
            return await interaction.reply({
                content: '❌ Apenas staff pode adicionar notas internas.',
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`ticket:note-modal:${ticket.ticketId}`)
            .setTitle('Adicionar Nota Interna');

        const noteInput = new TextInputBuilder()
            .setCustomId('note-text')
            .setLabel('Nota Interna')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Adiciona uma nota que apenas o staff pode ver...')
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(noteInput));

        await interaction.showModal(modal);
        return true;
    }

    // Resposta rápida (Canned Response)
    async handleCannedResponse(interaction, ticket, isStaff) {
        if (!isStaff) {
            return await interaction.reply({
                content: '❌ Apenas staff pode usar respostas rápidas.',
                ephemeral: true
            });
        }

        const selectedValue = interaction.values[0];
        const cannedResponse = this.componentManager.getCannedResponse(selectedValue);

        if (!cannedResponse) {
            return await interaction.reply({
                content: '❌ Resposta rápida não encontrada.',
                ephemeral: true
            });
        }

        // Modal para editar a resposta antes de enviar
        const modal = new ModalBuilder()
            .setCustomId(`ticket:canned-modal:${ticket.ticketId}:${selectedValue}`)
            .setTitle(`Resposta: ${cannedResponse.label}`);

        const responseInput = new TextInputBuilder()
            .setCustomId('canned-content')
            .setLabel('Mensagem (editável)')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(cannedResponse.content)
            .setRequired(true)
            .setMaxLength(2000);

        modal.addComponents(new ActionRowBuilder().addComponents(responseInput));

        await interaction.showModal(modal);
        return true;
    }

    // Gerar transcript
    async generateTranscript(channel, ticket) {
        try {
            const messages = [];
            let lastMessageId;

            // Buscar todas as mensagens (paginação)
            while (true) {
                const fetchOptions = { limit: 100 };
                if (lastMessageId) {
                    fetchOptions.before = lastMessageId;
                }

                const batch = await channel.messages.fetch(fetchOptions);
                if (batch.size === 0) break;

                messages.push(...batch.values());
                lastMessageId = batch.last().id;
            }

            // Ordenar cronologicamente
            messages.reverse();

            // Formatar transcript
            let transcript = `=== TRANSCRIPT DO TICKET #${ticket.ticketId} ===\n`;
            transcript += `🏷️ Servidor: ${channel.guild.name}\n`;
            transcript += `🆔 ID do Servidor: ${channel.guild.id}\n`;
            transcript += `📍 Canal: #${channel.name}\n`;
            transcript += `🆔 ID do Canal: ${channel.id}\n`;
            transcript += `👤 Criado por: ${ticket.ownerId}\n`;
            transcript += `📅 Data de Criação: ${new Date(ticket.createdAt).toLocaleString('pt-PT')}\n`;
            transcript += `📅 Data de Fecho: ${new Date().toLocaleString('pt-PT')}\n`;
            transcript += `=======================================\n\n`;

            messages.forEach(msg => {
                const timestamp = msg.createdAt.toLocaleString('pt-PT');
                const author = getUserDisplayName(msg.author, channel.guild);
                const content = msg.content || '[Sem conteúdo]';
                
                transcript += `[${timestamp}] ${author}: ${content}\n`;
                
                if (msg.attachments.size > 0) {
                    msg.attachments.forEach(attachment => {
                        transcript += `  📎 Anexo: ${attachment.url}\n`;
                    });
                }
            });

            return transcript;

        } catch (error) {
            logger.error('Erro ao gerar transcript:', error);
            return null;
        }
    }

    // Enviar para webhooks
    async sendToWebhooks(ticket, transcript, guild) {
        try {
            const owner = await this.client.users.fetch(ticket.ownerId);
            const closedBy = await this.client.users.fetch(ticket.closedBy);

            const logData = {
                author: owner,
                closedBy: closedBy,
                guild: guild,
                sequentialId: ticket.ticketId,
                channelId: ticket.channelId,
                transcript: transcript,
                duration: this.embedManager.calculateTotalTime(ticket.createdAt, ticket.closedAt),
                reason: ticket.closeReason
            };

            await this.webhookManager.sendTicketLog(guild.id, 'ticket_close', logData);
        } catch (error) {
            logger.error('Erro ao enviar para webhooks:', error);
        }
    }

    // Enviar transcript por DM
    async sendTranscriptDM(ticket, transcript, guild) {
        try {
            const owner = await this.client.users.fetch(ticket.ownerId);
            const closedBy = await this.client.users.fetch(ticket.closedBy);

            await owner.send({
                content: `🔒 **O TEU TICKET FOI FECHADO**\n\n` +
                        `📋 **Informações do Ticket:**\n` +
                        `• **Servidor:** ${guild.name}\n` +
                        `• **Ticket ID:** #${ticket.ticketId}\n` +
                        `• **Fechado por:** ${getUserDisplayName(closedBy, guild)}\n` +
                        `• **Data:** ${new Date().toLocaleString('pt-PT')}\n\n` +
                        `📎 A transcrição completa está anexada abaixo.`,
                files: [{
                    attachment: Buffer.from(transcript, 'utf8'),
                    name: `ticket-${ticket.ticketId}-transcript.txt`
                }]
            });

        } catch (error) {
            logger.warn(`Não foi possível enviar DM para o utilizador ${ticket.ownerId}:`, error);
        }
    }

    // Verificar se é staff (usando auto-detecção)
    isStaff(member) {
        return this.permissionManager.isStaff(member);
    }

    // Auto-configurar cargos de staff no primeiro uso
    async ensureStaffRolesConfigured(guild) {
        const cacheKey = `staff_roles_${guild.id}`;
        
        // Verificar cache (válido por 1 hora)
        if (this.staffRoleCache.has(cacheKey)) {
            const cached = this.staffRoleCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 60 * 60 * 1000) {
                return cached.roles;
            }
        }

        // Auto-detectar e configurar
        const result = await this.permissionManager.autoConfigureStaffRoles(guild);
        
        // Cache resultado
        this.staffRoleCache.set(cacheKey, {
            roles: result.configured,
            timestamp: Date.now()
        });

        logger.info(`Auto-configurados ${result.detected.length} cargos de staff em ${guild.name}:`, 
                   result.detected.map(r => r.name));

        return result.configured;
    }

    // Atualizar embed do ticket
    async updateTicketEmbed(interaction, ticket) {
        try {
            const owner = await this.client.users.fetch(ticket.ownerId);
            const claimedBy = ticket.claimedBy ? await this.client.users.fetch(ticket.claimedBy) : null;

            const embed = this.embedManager.createTicketEmbed(
                ticket, 
                interaction.guild, 
                owner, 
                claimedBy
            );

            const isStaff = this.isStaff(interaction.member);
            const isOwner = ticket.ownerId === interaction.user.id;

            const components = this.componentManager.createActiveTicketComponents(
                ticket.ticketId, 
                isStaff, 
                isOwner, 
                ticket
            );

            const validatedComponents = this.componentManager.validateComponents(components);
            const updatedComponents = this.componentManager.updateButtonStates(validatedComponents, ticket);

            await interaction.update({
                embeds: [embed],
                components: updatedComponents
            });

        } catch (error) {
            logger.error('Erro ao atualizar embed:', error);
        }
    }

    // Fechar canal
    async closeChannel(channel, ticket) {
        try {
            // Opção 1: Apagar canal
            await channel.delete(`Ticket #${ticket.ticketId} fechado`);
            
            // Opção 2: Mover para categoria "Arquivados" (comentar a linha acima e descomentar abaixo)
            // const archivedCategory = channel.guild.channels.cache.find(c => c.name.toLowerCase().includes('arquivo'));
            // if (archivedCategory) {
            //     await channel.setParent(archivedCategory.id);
            //     await channel.permissionOverwrites.edit(ticket.ownerId, { ViewChannel: false });
            // }

        } catch (error) {
            logger.error('Erro ao fechar canal:', error);
        }
    }

    // Handler para criar ticket
    async handleCreateTicket(interaction, category) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Mapear categorias
            const categoryMap = {
                'technical': { name: 'Suporte Técnico', emoji: '🔧', color: '#3498db' },
                'incident': { name: 'Reportar Problema', emoji: '⚠️', color: '#e74c3c' },
                'moderation': { name: 'Moderação', emoji: '🛡️', color: '#9b59b6' }
            };

            const categoryInfo = categoryMap[category] || categoryMap['technical'];

            // Criar canal do ticket
            const ticketId = `ticket-${Date.now()}`;
            const channelName = `${categoryInfo.emoji}-${category}-${interaction.user.username}`.toLowerCase();

            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: 0, // GUILD_TEXT
                parent: await this.getOrCreateTicketCategory(interaction.guild),
                topic: `Ticket: ${categoryInfo.name} | Usuário: ${interaction.user.tag}`,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    }
                ]
            });

            // Criar embed avançado do ticket
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            
            const ticketEmbed = new EmbedBuilder()
                .setColor(categoryInfo.color)
                .setTitle(`${categoryInfo.emoji} **${categoryInfo.name.toUpperCase()} TICKET**`)
                .setDescription([
                    '### 📋 **INFORMAÇÕES DO TICKET**',
                    '',
                    `🏷️ **Categoria:** \`${categoryInfo.name}\``,
                    `👤 **Criado por:** ${interaction.user}`,
                    `📅 **Data:** <t:${Math.floor(Date.now() / 1000)}:R>`,
                    `🆔 **ID:** \`${ticketChannel.id}\``,
                    '',
                    '### 🎯 **PRÓXIMOS PASSOS**',
                    '```',
                    '1️⃣ Staff assumirá o ticket',
                    '2️⃣ Análise do problema reportado',  
                    '3️⃣ Resolução personalizada',
                    '4️⃣ Confirmação de satisfação',
                    '```',
                    '',
                    '> 💡 **Nossa equipe responde em média 15 minutos**'
                ].join('\\n'))
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setImage('https://via.placeholder.com/600x100/5865F2/FFFFFF?text=IGNIS+SUPPORT+SYSTEM')
                .setFooter({ 
                    text: `${interaction.guild.name} • IGNIS Ticket System • Ticket #${Date.now().toString().slice(-6)}`,
                    iconURL: interaction.guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            // Botões de controle avançados
            const controlButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ticket:claim:${ticketId}`)
                        .setLabel('ASSUMIR TICKET')
                        .setEmoji('👑')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`ticket:close:${ticketId}`)
                        .setLabel('FECHAR TICKET')
                        .setEmoji('🔒')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`ticket:addnote:${ticketId}`)
                        .setLabel('ADICIONAR NOTA')
                        .setEmoji('📝')
                        .setStyle(ButtonStyle.Secondary)
                );

            // Segunda linha de botões - Ações extras
            const extraButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ticket:transcript:${ticketId}`)
                        .setLabel('TRANSCRIÇÃO')
                        .setEmoji('📄')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`ticket:escalate:${ticketId}`)
                        .setLabel('ESCALAR')
                        .setEmoji('📈')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`ticket:transfer:${ticketId}`)
                        .setLabel('TRANSFERIR')
                        .setEmoji('🔄')
                        .setStyle(ButtonStyle.Primary)
                );

            // Salvar ticket na base de dados
            const ticketData = {
                id: ticketId,
                channelId: ticketChannel.id,
                ownerId: interaction.user.id,
                category: category,
                status: 'open',
                createdAt: Date.now(),
                claimedBy: null,
                guildId: interaction.guild.id
            };

            this.database.createTicket(ticketData);

            // Enviar embed no canal do ticket
            await ticketChannel.send({
                content: `${interaction.user} **Ticket criado com sucesso!** 🎉\\n\\n🛎️ **Nossa equipe foi notificada e responderá em breve.**`,
                embeds: [ticketEmbed],
                components: [controlButtons, extraButtons]
            });

            // Responder ao utilizador
            await interaction.editReply({
                content: `✅ **Ticket criado com sucesso!**\\n🎫 **Canal:** ${ticketChannel}\\n📂 **Categoria:** ${categoryInfo.name}`
            });

            return true;

        } catch (error) {
            logger.error('Erro ao criar ticket:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Erro ao criar ticket. Contacte um administrador.',
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: '❌ Erro ao criar ticket. Contacte um administrador.'
                });
            }
            return false;
        }
    }

    // Método auxiliar para obter ou criar categoria de tickets
    async getOrCreateTicketCategory(guild) {
        let ticketCategory = guild.channels.cache.find(c => c.name === '📁 TICKETS' && c.type === 4);
        
        if (!ticketCategory) {
            try {
                ticketCategory = await guild.channels.create({
                    name: '📁 TICKETS',
                    type: 4, // GUILD_CATEGORY
                    reason: 'Categoria criada automaticamente para sistema de tickets'
                });
            } catch (error) {
                logger.error('Erro ao criar categoria de tickets:', error);
                throw new Error('FAILED_TO_CREATE_TICKET_CATEGORY');
            }
        }
        
        return ticketCategory;
    }

    // Atualizar permissões do canal
    async updateChannelPermissions(channel, ticket) {
        try {
            // Remover acesso de outros staff quando ticket é claimed
            if (ticket.claimedBy) {
                // Implementar lógica de permissões específica conforme necessário
            }
        } catch (error) {
            logger.error('Erro ao atualizar permissões:', error);
        }
    }
}

module.exports = TicketInteractionHandler;