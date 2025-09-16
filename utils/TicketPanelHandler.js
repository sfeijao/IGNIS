const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');
const TicketDatabase = require('./TicketDatabase');
const TicketPanelManager = require('./TicketPanelManager');
const RobustWebhookManager = require('./RobustWebhookManager');
const { getUserDisplayName } = require('./userHelper');
const logger = require('./logger');

class TicketPanelHandler {
    constructor(client) {
        this.client = client;
        this.database = new TicketDatabase();
        this.panelManager = new TicketPanelManager(client);
        this.webhookManager = new RobustWebhookManager();
    }

    /**
     * Handler principal para interações do novo painel
     */
    async handlePanelInteraction(interaction) {
        if (!interaction.customId || !interaction.customId.startsWith('ticket_panel:')) {
            return false;
        }

        const [prefix, action, ticketId] = interaction.customId.split(':');
        
        // Verificar se o ticket existe
        const ticket = this.database.getTicket(ticketId);
        if (!ticket) {
            return await interaction.reply({
                content: '❌ Ticket não encontrado ou já foi removido.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Verificar permissões
        const isStaff = this.isStaff(interaction.member);
        const isOwner = ticket.ownerId === interaction.user.id;

        try {
            switch (action) {
                // === AÇÕES DE STAFF ===
                case 'claim':
                    return await this.handleClaim(interaction, ticket, isStaff);
                
                case 'close':
                    return await this.handleClose(interaction, ticket, isStaff, isOwner);
                
                case 'add_note':
                    return await this.handleAddNote(interaction, ticket, isStaff);
                
                case 'history':
                    return await this.handleHistory(interaction, ticket, isStaff);
                
                case 'escalate':
                    return await this.handleEscalate(interaction, ticket, isStaff);
                
                case 'transfer':
                    return await this.handleTransfer(interaction, ticket, isStaff);
                
                case 'lock':
                    return await this.handleLock(interaction, ticket, isStaff);

                // === AÇÕES DE UTILIZADOR ===
                case 'edit_desc':
                    return await this.handleEditDescription(interaction, ticket, isOwner);
                
                case 'add_info':
                    return await this.handleAddInfo(interaction, ticket, isOwner);
                
                case 'urgent':
                    return await this.handleUrgent(interaction, ticket, isOwner);
                
                case 'language':
                    return await this.handleLanguage(interaction, ticket, isOwner);

                default:
                    logger.warn(`Ação de painel desconhecida: ${action}`);
                    return false;
            }
        } catch (error) {
            logger.error(`Erro ao processar ação do painel ${action}:`, error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Ocorreu um erro ao processar a ação. Tente novamente.',
                    flags: MessageFlags.Ephemeral
                });
            }
            
            return false;
        }
    }

    // === HANDLERS DE STAFF ===

    async handleClaim(interaction, ticket, isStaff) {
        if (!isStaff) {
            return await interaction.reply({
                content: '❌ Apenas membros da equipe podem assumir tickets.',
                flags: MessageFlags.Ephemeral
            });
        }

        if (ticket.claimedBy) {
            return await interaction.reply({
                content: '❌ Este ticket já foi assumido por outro membro da equipe.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Atualizar ticket
        ticket.claimedBy = interaction.user.id;
        ticket.status = 'claimed';
        this.database.updateTicket(ticket.ticketId, ticket);

        // Atualizar painel
        const guild = interaction.guild;
        const owner = await guild.members.fetch(ticket.ownerId).catch(() => null);
        const assignedStaff = interaction.member;
        
        await this.panelManager.updatePanel(interaction.channel, ticket, guild, owner, assignedStaff);

        // Log da ação
        await this.logAction(ticket, interaction.user, 'claim', 'Ticket assumido');

        await interaction.reply({
            content: `✅ **Ticket assumido com sucesso!**\n👥 **Responsável:** ${interaction.user}`,
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    async handleClose(interaction, ticket, isStaff, isOwner) {
        if (!isStaff && !isOwner) {
            return await interaction.reply({
                content: '❌ Apenas a equipe ou o criador do ticket podem fechá-lo.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Modal para motivo de fechamento
        const modal = new ModalBuilder()
            .setCustomId(`close_ticket_modal:${ticket.ticketId}`)
            .setTitle('Fechar Ticket');

        const reasonInput = new TextInputBuilder()
            .setCustomId('close_reason')
            .setLabel('Motivo do fechamento')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Descreva brevemente o motivo do fechamento...')
            .setRequired(false)
            .setMaxLength(500);

        const ratingInput = new TextInputBuilder()
            .setCustomId('rating')
            .setLabel('Avaliação do atendimento (1-5 estrelas)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Opcional - Digite um número de 1 a 5')
            .setRequired(false)
            .setMaxLength(1);

        modal.addComponents(
            new ActionRowBuilder().addComponents(reasonInput),
            new ActionRowBuilder().addComponents(ratingInput)
        );

        await interaction.showModal(modal);
        return true;
    }

    async handleAddNote(interaction, ticket, isStaff) {
        if (!isStaff) {
            return await interaction.reply({
                content: '❌ Apenas membros da equipe podem adicionar notas internas.',
                flags: MessageFlags.Ephemeral
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`add_note_modal:${ticket.ticketId}`)
            .setTitle('Adicionar Nota Interna');

        const noteInput = new TextInputBuilder()
            .setCustomId('internal_note')
            .setLabel('Nota para a equipe')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Esta nota será visível apenas para a equipe...')
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(noteInput));

        await interaction.showModal(modal);
        return true;
    }

    async handleHistory(interaction, ticket, isStaff) {
        if (!isStaff) {
            return await interaction.reply({
                content: '❌ Apenas membros da equipe podem ver o histórico.',
                flags: MessageFlags.Ephemeral
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`📂 Histórico do Ticket #${ticket.ticketId}`)
            .setColor(0x5865F2)
            .setTimestamp();

        // Informações básicas
        const createdAt = new Date(ticket.createdAt);
        let description = [
            `**Criado por:** <@${ticket.ownerId}>`,
            `**Data:** <t:${Math.floor(createdAt.getTime() / 1000)}:F>`,
            `**Categoria:** ${this.panelManager.getCategoryDisplayName(ticket.category)}`,
            `**Status:** ${ticket.status || 'open'}`,
            ''
        ];

        if (ticket.claimedBy) {
            description.push(`**Assumido por:** <@${ticket.claimedBy}>`);
        }

        if (ticket.escalated) {
            description.push('🚨 **Escalado:** Sim');
        }

        if (ticket.locked) {
            description.push('🔒 **Bloqueado:** Sim');
        }

        // Notas internas
        if (ticket.notes && ticket.notes.length > 0) {
            description.push('', '**📝 Notas Internas:**');
            ticket.notes.slice(-3).forEach((note, index) => {
                const noteDate = new Date(note.timestamp);
                description.push(`${index + 1}. \`${noteDate.toLocaleString('pt-PT')}\` - ${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}`);
            });
        }

        // Logs recentes
        if (ticket.logs && ticket.logs.length > 0) {
            description.push('', '**📊 Atividade Recente:**');
            ticket.logs.slice(-5).forEach((log, index) => {
                const logDate = new Date(log.timestamp);
                description.push(`${index + 1}. \`${logDate.toLocaleString('pt-PT')}\` - ${log.action}`);
            });
        }

        embed.setDescription(description.join('\n'));

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    async handleEscalate(interaction, ticket, isStaff) {
        if (!isStaff) {
            return await interaction.reply({
                content: '❌ Apenas membros da equipe podem escalar tickets.',
                flags: MessageFlags.Ephemeral
            });
        }

        if (ticket.escalated) {
            return await interaction.reply({
                content: '❌ Este ticket já foi escalado.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Escalar ticket
        ticket.escalated = true;
        ticket.priority = 'urgente';
        ticket.status = 'escalated';
        this.database.updateTicket(ticket.ticketId, ticket);

        // Atualizar painel
        const guild = interaction.guild;
        const owner = await guild.members.fetch(ticket.ownerId).catch(() => null);
        const assignedStaff = ticket.claimedBy ? await guild.members.fetch(ticket.claimedBy).catch(() => null) : null;
        
        await this.panelManager.updatePanel(interaction.channel, ticket, guild, owner, assignedStaff);

        // Log da ação
        await this.logAction(ticket, interaction.user, 'escalate', 'Ticket escalado para prioridade urgente');

        await interaction.reply({
            content: '🚨 **Ticket escalado com sucesso!**\nPrioridade alterada para URGENTE.',
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    async handleTransfer(interaction, ticket, isStaff) {
        if (!isStaff) {
            return await interaction.reply({
                content: '❌ Apenas membros da equipe podem transferir tickets.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Modal para nova categoria
        const modal = new ModalBuilder()
            .setCustomId(`transfer_modal:${ticket.ticketId}`)
            .setTitle('Transferir Ticket');

        const categoryInput = new TextInputBuilder()
            .setCustomId('new_category')
            .setLabel('Nova categoria')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: technical, support, billing...')
            .setRequired(true)
            .setMaxLength(50);

        const reasonInput = new TextInputBuilder()
            .setCustomId('transfer_reason')
            .setLabel('Motivo da transferência')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Explique o motivo da transferência...')
            .setRequired(false)
            .setMaxLength(300);

        modal.addComponents(
            new ActionRowBuilder().addComponents(categoryInput),
            new ActionRowBuilder().addComponents(reasonInput)
        );

        await interaction.showModal(modal);
        return true;
    }

    async handleLock(interaction, ticket, isStaff) {
        if (!isStaff) {
            return await interaction.reply({
                content: '❌ Apenas membros da equipe podem bloquear tickets.',
                flags: MessageFlags.Ephemeral
            });
        }

        const isLocking = !ticket.locked;
        ticket.locked = isLocking;
        this.database.updateTicket(ticket.ticketId, ticket);

        // Atualizar permissões do canal
        const channel = interaction.channel;
        const owner = await interaction.guild.members.fetch(ticket.ownerId).catch(() => null);
        
        if (owner) {
            await channel.permissionOverwrites.edit(owner, {
                SendMessages: !isLocking,
                AttachFiles: !isLocking
            });
        }

        // Atualizar painel
        const guild = interaction.guild;
        const assignedStaff = ticket.claimedBy ? await guild.members.fetch(ticket.claimedBy).catch(() => null) : null;
        
        await this.panelManager.updatePanel(channel, ticket, guild, owner, assignedStaff);

        // Log da ação
        await this.logAction(ticket, interaction.user, isLocking ? 'lock' : 'unlock', 
            isLocking ? 'Ticket bloqueado' : 'Ticket desbloqueado');

        await interaction.reply({
            content: isLocking 
                ? '🔒 **Ticket bloqueado!** O utilizador não pode mais enviar mensagens.' 
                : '🔓 **Ticket desbloqueado!** O utilizador pode voltar a enviar mensagens.',
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    // === HANDLERS DE UTILIZADOR ===

    async handleEditDescription(interaction, ticket, isOwner) {
        if (!isOwner) {
            return await interaction.reply({
                content: '❌ Apenas o criador do ticket pode editar a descrição.',
                flags: MessageFlags.Ephemeral
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`edit_desc_modal:${ticket.ticketId}`)
            .setTitle('Editar Descrição do Ticket');

        const descInput = new TextInputBuilder()
            .setCustomId('new_description')
            .setLabel('Nova descrição')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Descreva detalhadamente o seu problema...')
            .setValue(ticket.description || '')
            .setRequired(true)
            .setMaxLength(1500);

        modal.addComponents(new ActionRowBuilder().addComponents(descInput));

        await interaction.showModal(modal);
        return true;
    }

    async handleAddInfo(interaction, ticket, isOwner) {
        if (!isOwner) {
            return await interaction.reply({
                content: '❌ Apenas o criador do ticket pode adicionar informações.',
                flags: MessageFlags.Ephemeral
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`add_info_modal:${ticket.ticketId}`)
            .setTitle('Adicionar Informações');

        const infoInput = new TextInputBuilder()
            .setCustomId('additional_info')
            .setLabel('Informações adicionais')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Adicione detalhes que possam ajudar a resolver o problema...')
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(infoInput));

        await interaction.showModal(modal);
        return true;
    }

    async handleUrgent(interaction, ticket, isOwner) {
        if (!isOwner) {
            return await interaction.reply({
                content: '❌ Apenas o criador do ticket pode solicitar urgência.',
                flags: MessageFlags.Ephemeral
            });
        }

        if (ticket.escalated) {
            return await interaction.reply({
                content: '❌ Este ticket já foi marcado como urgente.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Verificar cooldown
        if (this.panelManager.isOnCooldown(interaction.user.id, 'urgency')) {
            const remaining = this.panelManager.getCooldownTime(interaction.user.id, 'urgency');
            return await interaction.reply({
                content: `❌ Você só pode solicitar urgência a cada 24 horas.\n⏰ Tempo restante: ${remaining}`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Modal para justificativa
        const modal = new ModalBuilder()
            .setCustomId(`urgent_modal:${ticket.ticketId}`)
            .setTitle('Solicitar Urgência');

        const reasonInput = new TextInputBuilder()
            .setCustomId('urgency_reason')
            .setLabel('Justifique a urgência')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Explique porque este ticket precisa de atenção prioritária...')
            .setRequired(true)
            .setMaxLength(500);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

        await interaction.showModal(modal);
        return true;
    }

    async handleLanguage(interaction, ticket, isOwner) {
        if (!isOwner) {
            return await interaction.reply({
                content: '❌ Apenas o criador do ticket pode trocar o idioma.',
                flags: MessageFlags.Ephemeral
            });
        }

        const currentLang = ticket.language || 'pt';
        const newLang = currentLang === 'pt' ? 'en' : 'pt';
        
        ticket.language = newLang;
        this.database.updateTicket(ticket.ticketId, ticket);

        // Log da ação
        await this.logAction(ticket, interaction.user, 'language_change', 
            `Idioma alterado de ${currentLang.toUpperCase()} para ${newLang.toUpperCase()}`);

        await interaction.reply({
            content: newLang === 'en' 
                ? '🌐 **Language changed to English!** The support team will respond in English.'
                : '🌐 **Idioma alterado para Português!** A equipe responderá em português.',
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    // === MÉTODOS AUXILIARES ===

    isStaff(member) {
        if (!member) return false;
        
        // Verificar permissões administrativas
        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            return true;
        }
        
        // Verificar permissões de moderação
        if (member.permissions.has(PermissionFlagsBits.ManageMessages) || 
            member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return true;
        }
        
        // Verificar roles de staff (nomes comuns)
        const staffRoleNames = ['staff', 'suporte', 'support', 'moderador', 'mod', 'admin', 'team'];
        return member.roles.cache.some(role => 
            staffRoleNames.some(name => 
                role.name.toLowerCase().includes(name)
            )
        );
    }

    async logAction(ticket, user, action, description) {
        try {
            // Adicionar ao log do ticket
            if (!ticket.logs) ticket.logs = [];
            ticket.logs.push({
                timestamp: new Date().toISOString(),
                userId: user.id,
                userName: user.username,
                action: action,
                description: description
            });

            // Salvar no database
            this.database.updateTicket(ticket.ticketId, ticket);

            // Log no sistema
            logger.info(`Ticket ${ticket.ticketId} - ${action}: ${description} por ${user.username}`);

            // Enviar para webhook se configurado
            await this.webhookManager.sendTicketLog(user.guild?.id, `ticket_${action}`, {
                ticketId: ticket.ticketId,
                userId: user.id,
                userName: user.username,
                action: action,
                description: description,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error(`Erro ao registrar ação ${action} do ticket ${ticket.ticketId}:`, error);
        }
    }
}

module.exports = TicketPanelHandler;