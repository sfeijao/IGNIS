const { 
    ticketTypes, 
    ticketPriorities, 
    ticketStatus 
} = require('../constants/ticketConstants');

const TicketTimeout = require('./ticketTimeout');
const NotificationManager = require('./notificationManager');

class TicketManager {
    constructor(client) {
        this.client = client;
        this.storage = client.storage;
        this.timeout = new TicketTimeout(client);
        this.notifications = new NotificationManager(client);

        // Bind methods to ensure correct 'this' context
        this.handleTicketCreate = this.handleTicketCreate.bind(this);
        this.handleTicketClose = this.handleTicketClose.bind(this);
        this.handleTicketClaim = this.handleTicketClaim.bind(this);
    }

    async handleTicketCreate(interaction, type) {
        try {
            // Verificar limite de tickets
            const existingTickets = await this.storage.getTickets(interaction.guildId);
            const hasOpenTicket = existingTickets.some(t => 
                t.user_id === interaction.user.id && 
                (t.status === 'open' || t.status === 'assigned')
            );

            if (hasOpenTicket) {
                return await interaction.editReply({
                    content: `❌ Você já tem um ticket aberto.`,
                    ephemeral: true
                });
            }

            // Mostrar modal para detalhes do ticket
            const modal = {
                customId: `ticket_modal_${type}`,
                title: this.getModalTitle(type),
                components: [{
                    type: 1,
                    components: [{
                        type: 4,
                        customId: 'description',
                        label: 'Descreva seu problema/solicitação',
                        style: 2,
                        minLength: 20,
                        maxLength: 1000,
                        placeholder: 'Seja detalhado para receber ajuda mais rapidamente',
                        required: true
                    }]
                }]
            };

            await interaction.showModal(modal);
        } catch (error) {
            console.error('Erro ao criar ticket:', error);
            await interaction.editReply({
                content: '❌ Erro ao criar ticket. Tente novamente.',
                ephemeral: true
            });
        }
    }

    async createTicket(guildId, userId, channelId, data) {
        try {
            // Verificar tickets existentes com lock
            const existingTickets = await this.storage.getTickets(guildId);
            const hasOpenTicket = existingTickets.some(t => 
                t.user_id === userId && 
                (t.status === 'open' || t.status === 'assigned')
            );

            if (hasOpenTicket) {
                throw new Error('USER_HAS_OPEN_TICKET');
            }

            const ticket = {
                id: Date.now(),
                guild_id: guildId,
                channel_id: channelId,
                user_id: userId,
                subject: data.subject,
                description: data.description,
                category: data.category,
                priority: data.priority || 'normal',
                status: 'open',
                created_at: new Date().toISOString(),
                assigned_to: null,
                closed_at: null,
                closed_by: null,
                close_reason: null,
                last_activity: new Date().toISOString()
            };

            // Criar canal do ticket
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) throw new Error('GUILD_NOT_FOUND');

            const category = await this.getOrCreateTicketCategory(guild);
            const channel = await this.createTicketChannel(guild, userId, category, data.type);

            ticket.channel_id = channel.id;
            await this.setupTicketChannel(channel, userId, ticket, data.type);

            // Salvar e retornar o ticket
            await this.storage.createTicket(ticket);
            return ticket;
        } catch (error) {
            console.error('Erro ao criar ticket:', error);
            throw error;
        }

        try {
            await this.storage.createTicket(ticket);
            
            // Iniciar monitoramento de timeout
            await this.timeout.startTracking(ticket);
            
            // Notificar equipe sobre novo ticket
            const guild = await this.client.guilds.fetch(guildId);
            await this.notifications.notifyStaff(guild, ticket, 'create');
            
            return ticket;
        } catch (error) {
            if (error.code === 'DUPLICATE_ENTRY') {
                throw new Error('TICKET_ALREADY_EXISTS');
            }
            throw error;
        }
    }

    async closeTicket(ticketId, closerId, reason) {
        const ticket = await this.storage.getTicket(ticketId);
        if (!ticket) return null;

        const update = {
            status: 'closed',
            closed_at: new Date().toISOString(),
            closed_by: closerId,
            close_reason: reason
        };

        await this.storage.updateTicket(ticketId, update);
        return { ...ticket, ...update };
    }

    async assignTicket(ticketId, staffId) {
        const ticket = await this.storage.getTicket(ticketId);
        if (!ticket) return null;

        const update = {
            status: 'assigned',
            assigned_to: staffId
        };

        await this.storage.updateTicket(ticketId, update);
        return { ...ticket, ...update };
    }

    async getOpenTickets(guildId) {
        const tickets = await this.storage.getTickets(guildId);
        return tickets.filter(t => t.status === 'open' || t.status === 'assigned');
    }

    async getUserTickets(guildId, userId) {
        const tickets = await this.storage.getTickets(guildId);
        return tickets.filter(t => t.user_id === userId);
    }

    async archiveTicket(ticketId) {
        const ticket = await this.storage.getTicket(ticketId);
        if (!ticket) return null;

        const update = {
            status: 'archived',
            archived_at: new Date().toISOString()
        };

        await this.storage.updateTicket(ticketId, update);
        return { ...ticket, ...update };
    }

    // Funções de validação e utilidade
    isValidTicketType(type) {
        return type in ticketTypes;
    }

    isValidPriority(priority) {
        return priority in ticketPriorities;
    }

    getTicketEmbed(ticket) {
        const { EmbedBuilder } = require('discord.js');
        const type = ticketTypes[ticket.category];
        const priority = ticketPriorities[ticket.priority];
        const status = ticketStatus[ticket.status];

        return new EmbedBuilder()
            .setColor(type.cor)
            .setTitle(`${type.emoji} Ticket #${ticket.id}`)
            .setDescription(`**Assunto:** ${ticket.subject}`)
            .addFields(
                { name: 'Categoria', value: `${type.emoji} ${type.nome}`, inline: true },
                { name: 'Prioridade', value: `${priority.emoji} ${priority.nome}`, inline: true },
                { name: 'Status', value: `${status.emoji} ${status.nome}`, inline: true },
                { name: 'Descrição', value: ticket.description || 'Sem descrição' },
                { name: 'Autor', value: `<@${ticket.user_id}>`, inline: true },
                { name: 'Criado em', value: `<t:${Math.floor(new Date(ticket.created_at).getTime()/1000)}:F>`, inline: true }
            )
            .setFooter({ text: 'YSNM Ticket System' })
            .setTimestamp();
    }

    getTicketButtons(ticket) {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder();

        if (ticket.status === 'open') {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`ticket_assign_${ticket.id}`)
                    .setLabel('Atribuir para mim')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👋')
            );
        }

        if (ticket.status !== 'closed') {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`ticket_close_${ticket.id}`)
                    .setLabel('Fechar Ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );
        }

        return row;
    }
}

module.exports = TicketManager;
