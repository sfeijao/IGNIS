const { EmbedBuilder } = require('discord.js');
const { unifiedWebhookSystem, EventTypes } = require('./UnifiedWebhookSystem');
const logger = require('../logger');

/**
 * 🎉 GIVEAWAY WEBHOOK HANDLERS
 *
 * Funções especializadas para enviar logs de giveaways via webhook
 * COMPLETAMENTE SEPARADO dos logs de tickets
 */

class GiveawayWebhookHandler {
    /**
     * Criar embed base para giveaway
     */
    createBaseEmbed(giveaway, eventType) {
        const colors = {
            [EventTypes.GIVEAWAY_CREATE]: 0x9333EA,  // Roxo
            [EventTypes.GIVEAWAY_END]: 0x10B981,     // Verde
            [EventTypes.GIVEAWAY_WINNER]: 0xF59E0B   // Dourado
        };

        const embed = new EmbedBuilder()
            .setColor(colors[eventType] || 0xA78BFA)
            .setTimestamp();

        return embed;
    }

    /**
     * Log de criação de giveaway
     */
    async logCreate(guildId, giveaway, creator) {
        try {
            const embed = this.createBaseEmbed(giveaway, EventTypes.GIVEAWAY_CREATE);
            embed
                .setTitle('🎉 Novo Giveaway Criado')
                .setDescription(giveaway.prize || 'Prêmio não especificado');

            const fields = [];

            if (creator) {
                fields.push({
                    name: '👤 Criado por',
                    value: `<@${creator.id}> (${creator.tag})`,
                    inline: true
                });
            }

            if (giveaway.channel_id) {
                fields.push({
                    name: '💬 Canal',
                    value: `<#${giveaway.channel_id}>`,
                    inline: true
                });
            }

            if (giveaway.winners_count) {
                fields.push({
                    name: '🏆 Número de Vencedores',
                    value: giveaway.winners_count.toString(),
                    inline: true
                });
            }

            if (giveaway.end_time) {
                const endTimestamp = Math.floor(new Date(giveaway.end_time).getTime() / 1000);
                fields.push({
                    name: '⏰ Termina em',
                    value: `<t:${endTimestamp}:R>`,
                    inline: true
                });
            }

            if (giveaway.requirements) {
                const reqText = this.formatRequirements(giveaway.requirements);
                if (reqText) {
                    fields.push({
                        name: '📋 Requisitos',
                        value: reqText,
                        inline: false
                    });
                }
            }

            if (fields.length > 0) {
                embed.addFields(fields);
            }

            await unifiedWebhookSystem.send(
                guildId,
                EventTypes.GIVEAWAY_CREATE,
                { embeds: [embed] },
                { trackingId: giveaway.id }
            );

            logger.info(`[GiveawayWebhook] Log de criação enviado: Giveaway #${giveaway.id}`);
            return true;
        } catch (error) {
            logger.error('[GiveawayWebhook] Erro ao enviar log de criação:', error);
            return false;
        }
    }

    /**
     * Log de finalização de giveaway
     */
    async logEnd(guildId, giveaway, winners) {
        try {
            const embed = this.createBaseEmbed(giveaway, EventTypes.GIVEAWAY_END);
            embed
                .setTitle('🏁 Giveaway Finalizado')
                .setDescription(giveaway.prize || 'Prêmio não especificado');

            const fields = [];

            if (winners && winners.length > 0) {
                const winnersText = winners
                    .map(w => `• <@${w.id}> (${w.tag})`)
                    .join('\n');

                fields.push({
                    name: `🏆 ${winners.length === 1 ? 'Vencedor' : 'Vencedores'}`,
                    value: winnersText.slice(0, 1024),
                    inline: false
                });
            } else {
                fields.push({
                    name: '❌ Resultado',
                    value: 'Nenhum vencedor (sem participantes válidos)',
                    inline: false
                });
            }

            if (giveaway.total_entries) {
                fields.push({
                    name: '👥 Total de Participantes',
                    value: giveaway.total_entries.toString(),
                    inline: true
                });
            }

            if (giveaway.created_at && giveaway.end_time) {
                const duration = new Date(giveaway.end_time) - new Date(giveaway.created_at);
                const days = Math.floor(duration / (1000 * 60 * 60 * 24));
                const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                fields.push({
                    name: '⏱️ Duração',
                    value: `${days}d ${hours}h`,
                    inline: true
                });
            }

            if (fields.length > 0) {
                embed.addFields(fields);
            }

            await unifiedWebhookSystem.send(
                guildId,
                EventTypes.GIVEAWAY_END,
                { embeds: [embed] },
                { trackingId: giveaway.id }
            );

            logger.info(`[GiveawayWebhook] Log de finalização enviado: Giveaway #${giveaway.id}`);
            return true;
        } catch (error) {
            logger.error('[GiveawayWebhook] Erro ao enviar log de finalização:', error);
            return false;
        }
    }

    /**
     * Log quando giveaway cria ticket para vencedor
     */
    async logWinnerTicket(guildId, giveaway, winner, ticketId) {
        try {
            const embed = this.createBaseEmbed(giveaway, EventTypes.GIVEAWAY_WINNER);
            embed
                .setTitle('🎫 Ticket de Vencedor Criado')
                .setDescription(`Ticket criado automaticamente para o vencedor do giveaway **${giveaway.prize}**`);

            const fields = [
                {
                    name: '🏆 Vencedor',
                    value: `<@${winner.id}> (${winner.tag})`,
                    inline: true
                },
                {
                    name: '🎫 Ticket ID',
                    value: `#${ticketId}`,
                    inline: true
                },
                {
                    name: '🎁 Prêmio',
                    value: giveaway.prize || 'Não especificado',
                    inline: false
                }
            ];

            if (giveaway.channel_id) {
                fields.push({
                    name: '💬 Giveaway Original',
                    value: `<#${giveaway.channel_id}>`,
                    inline: true
                });
            }

            embed.addFields(fields);

            await unifiedWebhookSystem.send(
                guildId,
                EventTypes.GIVEAWAY_WINNER,
                { embeds: [embed] }
            );

            logger.info(`[GiveawayWebhook] Log de ticket de vencedor enviado: Giveaway #${giveaway.id}, Ticket #${ticketId}`);
            return true;
        } catch (error) {
            logger.error('[GiveawayWebhook] Erro ao enviar log de ticket de vencedor:', error);
            return false;
        }
    }

    /**
     * Formatar requisitos do giveaway
     */
    formatRequirements(requirements) {
        if (!requirements || typeof requirements !== 'object') {
            return null;
        }

        const parts = [];

        if (requirements.min_level) {
            parts.push(`• Nível mínimo: ${requirements.min_level}`);
        }

        if (requirements.required_roles && requirements.required_roles.length > 0) {
            const roles = requirements.required_roles
                .map(roleId => `<@&${roleId}>`)
                .join(', ');
            parts.push(`• Cargos necessários: ${roles}`);
        }

        if (requirements.min_messages) {
            parts.push(`• Mensagens mínimas: ${requirements.min_messages}`);
        }

        if (requirements.account_age_days) {
            parts.push(`• Conta com pelo menos ${requirements.account_age_days} dias`);
        }

        return parts.length > 0 ? parts.join('\n') : null;
    }
}

// Singleton
const giveawayWebhookHandler = new GiveawayWebhookHandler();

module.exports = {
    GiveawayWebhookHandler,
    giveawayWebhookHandler
};
