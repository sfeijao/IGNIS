const { 
    EmbedBuilder,
    MessageFlags 
} = require('discord.js');
const TicketDatabase = require('./TicketDatabase');
const TicketPanelManager = require('./TicketPanelManager');
const logger = require('./logger');

class TicketModalHandler {
    constructor(client) {
        this.client = client;
        this.database = new TicketDatabase();
        this.panelManager = new TicketPanelManager(client);
    }

    /**
     * Handler principal para modals do sistema de tickets
     */
    async handleModalSubmit(interaction) {
        if (!interaction.customId || !interaction.customId.includes('_modal:')) {
            return false;
        }

        const [modalType, ticketId] = interaction.customId.split(':');
        
        // Verificar se o ticket existe
        const ticket = this.database.getTicket(ticketId);
        if (!ticket) {
            return await interaction.reply({
                content: '❌ Ticket não encontrado ou já foi removido.',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            switch (modalType) {
                case 'close_ticket_modal':
                    return await this.handleCloseModal(interaction, ticket);
                
                case 'add_note_modal':
                    return await this.handleAddNoteModal(interaction, ticket);
                
                case 'edit_desc_modal':
                    return await this.handleEditDescModal(interaction, ticket);
                
                case 'add_info_modal':
                    return await this.handleAddInfoModal(interaction, ticket);
                
                case 'urgent_modal':
                    return await this.handleUrgentModal(interaction, ticket);
                
                case 'transfer_modal':
                    return await this.handleTransferModal(interaction, ticket);

                default:
                    logger.warn(`Modal de ticket desconhecido: ${modalType}`);
                    return false;
            }
        } catch (error) {
            logger.error(`Erro ao processar modal ${modalType}:`, error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Ocorreu um erro ao processar a ação. Tente novamente.',
                    flags: MessageFlags.Ephemeral
                });
            }
            
            return false;
        }
    }

    async handleCloseModal(interaction, ticket) {
        const reason = interaction.fields.getTextInputValue('close_reason') || 'Nenhum motivo especificado';
        const rating = interaction.fields.getTextInputValue('rating');

        // Processar avaliação se fornecida
        let ratingNum = null;
        if (rating && /^[1-5]$/.test(rating)) {
            ratingNum = parseInt(rating);
        }

        // Atualizar ticket
        ticket.status = 'closed';
        ticket.closedAt = new Date().toISOString();
        ticket.closedBy = interaction.user.id;
        ticket.closeReason = reason;
        if (ratingNum) {
            ticket.rating = ratingNum;
        }

        this.database.updateTicket(ticket.ticketId, ticket);

        // Criar embed de fechamento
        const closeEmbed = new EmbedBuilder()
            .setTitle('🔒 Ticket Fechado')
            .setColor(0xF44336)
            .setDescription([
                `**Ticket #${ticket.ticketId} foi fechado**`,
                '',
                `**Fechado por:** ${interaction.user}`,
                `**Motivo:** ${reason}`,
                ratingNum ? `**Avaliação:** ${this.getStarRating(ratingNum)}` : '',
                '',
                '> Este canal será arquivado em breve.'
            ].filter(Boolean).join('\n'))
            .setTimestamp();

        // Desabilitar todas as interações do canal
        const channel = interaction.channel;
        
        // Remover permissões de escrita para todos, exceto staff
        const everyone = interaction.guild.roles.everyone;
        await channel.permissionOverwrites.edit(everyone, {
            SendMessages: false,
            AddReactions: false,
            AttachFiles: false
        });

        // Se o usuário criador ainda estiver no servidor, remover suas permissões
        try {
            const owner = await interaction.guild.members.fetch(ticket.ownerId);
            await channel.permissionOverwrites.edit(owner, {
                SendMessages: false,
                AddReactions: false,
                AttachFiles: false
            });
        } catch (error) {
            logger.warn(`Usuário ${ticket.ownerId} não encontrado ao fechar ticket`);
        }

        // Responder com embed de fechamento
        await interaction.reply({
            embeds: [closeEmbed]
        });

        // Log da ação
        await this.logAction(ticket, interaction.user, 'close', `Ticket fechado: ${reason}`);

        // Notificar webhook se configurado
        const RobustWebhookManager = require('./RobustWebhookManager');
        const webhookManager = new RobustWebhookManager();
        await webhookManager.sendTicketLog(interaction.guild.id, 'ticket_close', {
            ticketId: ticket.ticketId,
            userId: interaction.user.id,
            userName: interaction.user.username,
            reason: reason,
            rating: ratingNum,
            timestamp: ticket.closedAt
        });

        return true;
    }

    async handleAddNoteModal(interaction, ticket) {
        const note = interaction.fields.getTextInputValue('internal_note');

        // Adicionar nota interna
        if (!ticket.notes) ticket.notes = [];
        ticket.notes.push({
            timestamp: new Date().toISOString(),
            userId: interaction.user.id,
            userName: interaction.user.username,
            content: note
        });

        this.database.updateTicket(ticket.ticketId, ticket);

        // Log da ação
        await this.logAction(ticket, interaction.user, 'add_note', 'Nota interna adicionada');

        await interaction.reply({
            content: `✅ **Nota interna adicionada com sucesso!**\n📝 **Conteúdo:** ${note.substring(0, 100)}${note.length > 100 ? '...' : ''}`,
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    async handleEditDescModal(interaction, ticket) {
        const newDescription = interaction.fields.getTextInputValue('new_description');

        // Salvar descrição anterior para log
        const oldDescription = ticket.description;
        
        // Atualizar descrição
        ticket.description = newDescription;
        this.database.updateTicket(ticket.ticketId, ticket);

        // Atualizar painel se possível
        try {
            const guild = interaction.guild;
            const owner = await guild.members.fetch(ticket.ownerId).catch(() => null);
            const assignedStaff = ticket.claimedBy ? await guild.members.fetch(ticket.claimedBy).catch(() => null) : null;
            
            await this.panelManager.updatePanel(interaction.channel, ticket, guild, owner, assignedStaff);
        } catch (error) {
            logger.warn('Erro ao atualizar painel após edição de descrição:', error);
        }

        // Log da ação
        await this.logAction(ticket, interaction.user, 'edit_description', 'Descrição do ticket atualizada');

        await interaction.reply({
            content: '✅ **Descrição atualizada com sucesso!**\nO painel foi atualizado com as novas informações.',
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    async handleAddInfoModal(interaction, ticket) {
        const additionalInfo = interaction.fields.getTextInputValue('additional_info');

        // Adicionar informações adicionais
        if (!ticket.additionalInfo) ticket.additionalInfo = [];
        ticket.additionalInfo.push({
            timestamp: new Date().toISOString(),
            userId: interaction.user.id,
            userName: interaction.user.username,
            content: additionalInfo
        });

        this.database.updateTicket(ticket.ticketId, ticket);

        // Enviar mensagem visível no canal com as informações
        const infoEmbed = new EmbedBuilder()
            .setTitle('📝 Informações Adicionais')
            .setDescription(additionalInfo)
            .setColor(0x00D4AA)
            .setAuthor({
                name: interaction.user.username,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            })
            .setTimestamp();

        await interaction.channel.send({
            embeds: [infoEmbed]
        });

        // Log da ação
        await this.logAction(ticket, interaction.user, 'add_info', 'Informações adicionais fornecidas');

        await interaction.reply({
            content: '✅ **Informações adicionais enviadas!**\nSua mensagem foi adicionada ao ticket.',
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    async handleUrgentModal(interaction, ticket) {
        const urgencyReason = interaction.fields.getTextInputValue('urgency_reason');

        // Marcar como urgente
        ticket.escalated = true;
        ticket.priority = 'urgente';
        ticket.urgencyReason = urgencyReason;
        ticket.urgencyRequestedAt = new Date().toISOString();
        
        this.database.updateTicket(ticket.ticketId, ticket);

        // Definir cooldown de 24 horas
        this.panelManager.setCooldown(interaction.user.id, 'urgency', 24);

        // Atualizar painel
        try {
            const guild = interaction.guild;
            const owner = await guild.members.fetch(ticket.ownerId).catch(() => null);
            const assignedStaff = ticket.claimedBy ? await guild.members.fetch(ticket.claimedBy).catch(() => null) : null;
            
            await this.panelManager.updatePanel(interaction.channel, ticket, guild, owner, assignedStaff);
        } catch (error) {
            logger.warn('Erro ao atualizar painel após pedido de urgência:', error);
        }

        // Notificar a equipe
        const urgentEmbed = new EmbedBuilder()
            .setTitle('🆘 Pedido de Urgência')
            .setDescription([
                `**${interaction.user}** solicitou prioridade urgente para este ticket.`,
                '',
                `**Justificativa:**`,
                `${urgencyReason}`,
                '',
                '> Este ticket foi movido para a fila de prioridade alta.'
            ].join('\n'))
            .setColor(0xFF6B6B)
            .setTimestamp();

        await interaction.channel.send({
            embeds: [urgentEmbed]
        });

        // Log da ação
        await this.logAction(ticket, interaction.user, 'request_urgent', `Urgência solicitada: ${urgencyReason}`);

        await interaction.reply({
            content: '🆘 **Pedido de urgência enviado!**\nSeu ticket foi marcado como prioritário e nossa equipe será notificada.',
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    async handleTransferModal(interaction, ticket) {
        const newCategory = interaction.fields.getTextInputValue('new_category');
        const transferReason = interaction.fields.getTextInputValue('transfer_reason') || 'Transferência para departamento apropriado';

        // Validar categoria
        const validCategories = ['technical', 'account', 'report', 'suggestion', 'support', 'billing', 'feedback', 'partnership'];
        if (!validCategories.includes(newCategory)) {
            return await interaction.reply({
                content: `❌ **Categoria inválida!**\nCategorias válidas: ${validCategories.join(', ')}`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Salvar categoria anterior
        const oldCategory = ticket.category;
        
        // Atualizar ticket
        ticket.category = newCategory;
        ticket.claimedBy = null; // Reset responsável ao transferir
        this.database.updateTicket(ticket.ticketId, ticket);

        // Atualizar nome do canal se possível
        try {
            const newChannelName = `ticket-${newCategory}-${ticket.ticketId.slice(-6)}`;
            await interaction.channel.setName(newChannelName);
        } catch (error) {
            logger.warn('Erro ao renomear canal após transferência:', error);
        }

        // Atualizar painel
        try {
            const guild = interaction.guild;
            const owner = await guild.members.fetch(ticket.ownerId).catch(() => null);
            
            await this.panelManager.updatePanel(interaction.channel, ticket, guild, owner, null);
        } catch (error) {
            logger.warn('Erro ao atualizar painel após transferência:', error);
        }

        // Notificar sobre a transferência
        const transferEmbed = new EmbedBuilder()
            .setTitle('🔄 Ticket Transferido')
            .setDescription([
                `Este ticket foi transferido para a categoria **${this.panelManager.getCategoryDisplayName(newCategory)}**.`,
                '',
                `**Categoria anterior:** ${this.panelManager.getCategoryDisplayName(oldCategory)}`,
                `**Nova categoria:** ${this.panelManager.getCategoryDisplayName(newCategory)}`,
                `**Motivo:** ${transferReason}`,
                `**Transferido por:** ${interaction.user}`,
                '',
                '> O ticket foi redefinido e aguarda nova atribuição.'
            ].join('\n'))
            .setColor(0x5865F2)
            .setTimestamp();

        await interaction.channel.send({
            embeds: [transferEmbed]
        });

        // Log da ação
        await this.logAction(ticket, interaction.user, 'transfer', 
            `Transferido de ${oldCategory} para ${newCategory}: ${transferReason}`);

        await interaction.reply({
            content: `✅ **Ticket transferido com sucesso!**\nCategoria alterada para **${this.panelManager.getCategoryDisplayName(newCategory)}**.`,
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    // Métodos auxiliares
    getStarRating(rating) {
        const stars = '⭐'.repeat(rating);
        const empty = '☆'.repeat(5 - rating);
        return `${stars}${empty} (${rating}/5)`;
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

        } catch (error) {
            logger.error(`Erro ao registrar ação ${action} do ticket ${ticket.ticketId}:`, error);
        }
    }
}

module.exports = TicketModalHandler;