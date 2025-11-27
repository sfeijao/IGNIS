const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const logger = require('./logger');
const config = require('./config');
const { ticketWebhooks } = require('./webhooks');

class TicketSystem {
    constructor(client) {
        this.client = client;
    }

    // Função para enviar logs via webhook com retry e fallback
    async sendLogWebhook(guild, data, type = 'create', retryCount = 3) {
        try {
            // Usar novo sistema unificado de webhooks
            switch (type) {
                case 'create':
                    await ticketWebhooks.logCreate(guild.id, data);
                    break;
                case 'claim':
                case 'assign':
                    await ticketWebhooks.logClaim(guild.id, data, data.claimer || data.assigned_user);
                    break;
                case 'close':
                    await ticketWebhooks.logClose(guild.id, data, data.closer, data.close_reason, data.transcript);
                    break;
                case 'update':
                    await ticketWebhooks.logUpdate(guild.id, data, data.changes, data.updater);
                    break;
                default:
                    logger.warn(`[TicketSystem] Tipo de log desconhecido: ${type}`);
            }
        } catch (error) {
            logger.error(`[TicketSystem] Erro ao enviar webhook:`, error);
        }
    }

    // Função para verificar permissões de ticket
    async checkTicketPermissions(member, ticket) {
        if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
        return ticket.user_id === member.id || ticket.assigned_to === member.id;
    }

    // Função para fechar ticket
    async closeTicket(interaction, ticketId, reason) {
        try {
            const ticket = await this.client.storage.getTicket(ticketId);
            if (!ticket) {
                return await this._safeReply(interaction, { content: '❌ Ticket não encontrado.', flags: MessageFlags.Ephemeral });
            }

            const hasPermission = await this.checkTicketPermissions(interaction.member, ticket);
            if (!hasPermission) {
                return await this._safeReply(interaction, { content: '❌ Você não tem permissão para fechar este ticket.', flags: MessageFlags.Ephemeral });
            }

            // Atualizar ticket na base de dados
            await this.client.storage.updateTicket(ticketId, {
                status: 'closed',
                closed_at: new Date().toISOString(),
                closed_by: interaction.user.id,
                close_reason: reason
            });

            // Gerar transcrição
            const transcript = await this.generateTranscript(interaction.channel);

            // Enviar log
            await this.sendLogWebhook(interaction.guild, {
                ...ticket,
                closer: interaction.user,
                reason,
                transcript
            }, 'close');

            // Arquivar e deletar canal
            await interaction.channel.setName(`arquivado-${interaction.channel.name}`);
            setTimeout(() => interaction.channel.delete('Ticket fechado'), 5000);

            return await this._safeReply(interaction, { content: '✅ Ticket fechado com sucesso!', flags: MessageFlags.Ephemeral });

        } catch (error) {
            logger.error('Erro ao fechar ticket', { error: error.message, ticketId });
            return await this._safeReply(interaction, { content: '❌ Erro ao fechar ticket.', flags: MessageFlags.Ephemeral });
        }
    }

    // Função para gerar transcrição do canal
    async generateTranscript(channel) {
        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            const transcript = messages.reverse().map(msg => {
                return `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content}`;
            }).join('\n');
            return transcript;
        } catch (error) {
            logger.error('Erro ao gerar transcrição', { error: error.message, channelId: channel.id });
            return 'Erro ao gerar transcrição';
        }
    }

    // Funções auxiliares
    getStatusColor(type) {
        const colors = {
            'create': 0x2ecc71,
            'close': 0xe74c3c,
            'update': 0x3498db,
            'assign': 0xf1c40f
        };
        return colors[type] || 0x95a5a6;
    }

    getStatusText(type) {
        const texts = {
            'create': 'Criado',
            'close': 'Fechado',
            'update': 'Atualizado',
            'assign': 'Atribuído'
        };
        return texts[type] || 'Status Desconhecido';
    }

    generateLogFields(data) {
        const fields = [
            { name: '📝 ID', value: `#${data.id}`, inline: true },
            { name: '👤 Autor', value: `<@${data.user_id}>`, inline: true }
        ];

        if (data.assigned_to) {
            fields.push({ name: '👨‍💼 Atribuído para', value: `<@${data.assigned_to}>`, inline: true });
        }

        if (data.closer) {
            fields.push({ name: '🔒 Fechado por', value: `<@${data.closer.id}>`, inline: true });
        }

        if (data.reason) {
            fields.push({ name: '📋 Motivo', value: data.reason, inline: false });
        }

        return fields;
    }
}

// Helper para evitar InteractionAlreadyReplied
TicketSystem.prototype._safeReply = async function(interaction, data) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            return await interaction.reply(data);
        }
        return await interaction.followUp(data);
    } catch (e) {
        try {
            if (interaction.deferred) return await interaction.editReply(data);
        } catch (e) { logger.debug('Caught error:', e?.message || e); }
        throw e;
    }
};

module.exports = TicketSystem;
