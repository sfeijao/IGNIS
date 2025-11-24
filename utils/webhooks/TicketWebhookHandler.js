const { EmbedBuilder } = require('discord.js');
const { unifiedWebhookSystem, EventTypes } = require('./UnifiedWebhookSystem');
const logger = require('../logger');

/**
 * 🎫 TICKET WEBHOOK HANDLERS
 *
 * Funções especializadas para enviar logs de tickets via webhook
 */

class TicketWebhookHandler {
    /**
     * Criar embed base para ticket
     */
    createBaseEmbed(ticket, eventType) {
        const colors = {
            [EventTypes.TICKET_CREATE]: 0x3B82F6,  // Azul
            [EventTypes.TICKET_CLAIM]: 0xF59E0B,   // Amarelo
            [EventTypes.TICKET_CLOSE]: 0x10B981,   // Verde
            [EventTypes.TICKET_UPDATE]: 0xA78BFA   // Roxo
        };

        const statusEmojis = {
            open: '🟢',
            claimed: '🟡',
            pending: '🟣',
            closed: '✅'
        };

        const embed = new EmbedBuilder()
            .setColor(colors[eventType] || 0x95A5A6)
            .setTimestamp();

        // Informações básicas do ticket
        const fields = [];

        if (ticket.id) {
            embed.setTitle(`🎫 Ticket #${ticket.id}`);
        }

        if (ticket.user) {
            fields.push({
                name: '👤 Utilizador',
                value: `<@${ticket.user.id}> (${ticket.user.tag})`,
                inline: true
            });
        }

        if (ticket.category) {
            fields.push({
                name: '📂 Categoria',
                value: ticket.category,
                inline: true
            });
        }

        if (ticket.status) {
            const emoji = statusEmojis[ticket.status] || '⚪';
            fields.push({
                name: '📊 Status',
                value: `${emoji} ${ticket.status}`,
                inline: true
            });
        }

        if (ticket.priority && ticket.priority !== 'normal') {
            fields.push({
                name: '⚡ Prioridade',
                value: ticket.priority.toUpperCase(),
                inline: true
            });
        }

        if (ticket.assigned_to) {
            fields.push({
                name: '👨‍💼 Atribuído a',
                value: `<@${ticket.assigned_to}>`,
                inline: true
            });
        }

        if (ticket.channel_id) {
            fields.push({
                name: '💬 Canal',
                value: `<#${ticket.channel_id}>`,
                inline: true
            });
        }

        if (ticket.subject) {
            fields.push({
                name: '📝 Assunto',
                value: ticket.subject.slice(0, 1024),
                inline: false
            });
        }

        if (ticket.description) {
            fields.push({
                name: '📄 Descrição',
                value: ticket.description.slice(0, 1024),
                inline: false
            });
        }

        if (fields.length > 0) {
            embed.addFields(fields);
        }

        return embed;
    }

    /**
     * Log de criação de ticket
     */
    async logCreate(guildId, ticket) {
        try {
            const embed = this.createBaseEmbed(ticket, EventTypes.TICKET_CREATE);
            embed.setDescription('✨ **Novo ticket criado**');

            if (ticket.created_at) {
                embed.setFooter({
                    text: `Criado em ${new Date(ticket.created_at).toLocaleString('pt-PT')}`
                });
            }

            await unifiedWebhookSystem.send(
                guildId,
                EventTypes.TICKET_CREATE,
                { embeds: [embed] },
                { trackingId: ticket.id } // Para futuros updates
            );

            logger.info(`[TicketWebhook] Log de criação enviado: Ticket #${ticket.id}`);
            return true;
        } catch (error) {
            logger.error('[TicketWebhook] Erro ao enviar log de criação:', error);
            return false;
        }
    }

    /**
     * Log de claim de ticket
     */
    async logClaim(guildId, ticket, claimer) {
        try {
            const embed = this.createBaseEmbed(ticket, EventTypes.TICKET_CLAIM);
            embed.setDescription(`🙋 **Ticket atribuído a <@${claimer.id}>**`);

            if (claimer.tag) {
                embed.addFields({
                    name: '🎯 Atribuído por',
                    value: claimer.tag,
                    inline: true
                });
            }

            await unifiedWebhookSystem.send(
                guildId,
                EventTypes.TICKET_CLAIM,
                { embeds: [embed] },
                { trackingId: ticket.id }
            );

            logger.info(`[TicketWebhook] Log de claim enviado: Ticket #${ticket.id}`);
            return true;
        } catch (error) {
            logger.error('[TicketWebhook] Erro ao enviar log de claim:', error);
            return false;
        }
    }

    /**
     * Log de fechamento de ticket
     */
    async logClose(guildId, ticket, closer, reason, transcript) {
        try {
            const embed = this.createBaseEmbed(ticket, EventTypes.TICKET_CLOSE);
            embed.setDescription('🏁 **Ticket fechado**');

            const fields = [];

            if (closer) {
                fields.push({
                    name: '🔒 Fechado por',
                    value: `<@${closer.id}> (${closer.tag})`,
                    inline: true
                });
            }

            if (reason) {
                fields.push({
                    name: '📋 Motivo',
                    value: reason.slice(0, 1024),
                    inline: false
                });
            }

            if (ticket.closed_at) {
                const closedTimestamp = Math.floor(new Date(ticket.closed_at).getTime() / 1000);
                fields.push({
                    name: '⏰ Fechado em',
                    value: `<t:${closedTimestamp}:R>`,
                    inline: true
                });
            }

            // Duração do ticket
            if (ticket.created_at && ticket.closed_at) {
                const duration = new Date(ticket.closed_at) - new Date(ticket.created_at);
                const hours = Math.floor(duration / (1000 * 60 * 60));
                const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
                fields.push({
                    name: '⏱️ Duração',
                    value: `${hours}h ${minutes}m`,
                    inline: true
                });
            }

            if (transcript) {
                fields.push({
                    name: '📜 Transcrição',
                    value: transcript.slice(0, 1024) || 'Não disponível',
                    inline: false
                });
            }

            if (fields.length > 0) {
                embed.addFields(fields);
            }

            await unifiedWebhookSystem.send(
                guildId,
                EventTypes.TICKET_CLOSE,
                { embeds: [embed] },
                { trackingId: ticket.id }
            );

            logger.info(`[TicketWebhook] Log de fechamento enviado: Ticket #${ticket.id}`);
            return true;
        } catch (error) {
            logger.error('[TicketWebhook] Erro ao enviar log de fechamento:', error);
            return false;
        }
    }

    /**
     * Log de atualização de ticket
     */
    async logUpdate(guildId, ticket, changes, updater) {
        try {
            const embed = this.createBaseEmbed(ticket, EventTypes.TICKET_UPDATE);
            embed.setDescription('🔄 **Ticket atualizado**');

            const fields = [];

            if (updater) {
                fields.push({
                    name: '✏️ Atualizado por',
                    value: `<@${updater.id}> (${updater.tag})`,
                    inline: true
                });
            }

            if (changes && Object.keys(changes).length > 0) {
                const changesText = Object.entries(changes)
                    .map(([key, value]) => `• **${key}**: ${value.old} → ${value.new}`)
                    .join('\n');

                fields.push({
                    name: '📝 Alterações',
                    value: changesText.slice(0, 1024),
                    inline: false
                });
            }

            if (fields.length > 0) {
                embed.addFields(fields);
            }

            await unifiedWebhookSystem.send(
                guildId,
                EventTypes.TICKET_UPDATE,
                { embeds: [embed] },
                { trackingId: ticket.id }
            );

            logger.info(`[TicketWebhook] Log de atualização enviado: Ticket #${ticket.id}`);
            return true;
        } catch (error) {
            logger.error('[TicketWebhook] Erro ao enviar log de atualização:', error);
            return false;
        }
    }

    /**
     * Log de timeline (múltiplos eventos)
     */
    async logTimeline(guildId, ticket, timeline) {
        try {
            const embed = this.createBaseEmbed(ticket, EventTypes.TICKET_UPDATE);
            embed.setDescription('📋 **Timeline de eventos**');

            if (timeline && timeline.length > 0) {
                const timelineText = timeline
                    .slice(-10) // Últimos 10 eventos
                    .map(event => {
                        const timestamp = Math.floor(new Date(event.timestamp).getTime() / 1000);
                        return `• <t:${timestamp}:R> - ${event.action}`;
                    })
                    .join('\n');

                embed.addFields({
                    name: '🕐 Eventos Recentes',
                    value: timelineText || 'Nenhum evento',
                    inline: false
                });
            }

            await unifiedWebhookSystem.send(
                guildId,
                EventTypes.TICKET_UPDATE,
                { embeds: [embed] },
                { trackingId: ticket.id }
            );

            logger.info(`[TicketWebhook] Log de timeline enviado: Ticket #${ticket.id}`);
            return true;
        } catch (error) {
            logger.error('[TicketWebhook] Erro ao enviar log de timeline:', error);
            return false;
        }
    }
}

// Singleton
const ticketWebhookHandler = new TicketWebhookHandler();

module.exports = {
    TicketWebhookHandler,
    ticketWebhookHandler
};
