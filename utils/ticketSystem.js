const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const logger = require('./logger');
const config = require('./config');

class TicketSystem {
    constructor(client) {
        this.client = client;
    }

    // Função para enviar logs via webhook com retry e fallback
    async sendLogWebhook(guild, data, type = 'create', retryCount = 3) {
        try {
            const guildConfig = await this.client.storage.getGuildConfig(guild.id);
            const webhookUrl = guildConfig?.ticketWebhookUrl;
            
            if (!webhookUrl) {
                logger.warn('Webhook não configurado para logs de tickets', { guildId: guild.id });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(this.getStatusColor(type))
                .setTitle(`🎫 Ticket ${this.getStatusText(type)}`)
                .addFields(this.generateLogFields(data))
                .setTimestamp();

            try {
                const webhook = await this.client.fetchWebhook(webhookUrl);
                await webhook.send({ embeds: [embed] });
                logger.info(`Log de ticket enviado via webhook: ${type}`, { 
                    ticketId: data.id, 
                    guildId: guild.id 
                });
            } catch (webhookError) {
                if (retryCount > 0) {
                    logger.warn('Falha ao enviar webhook, tentando novamente...', {
                        guildId: guild.id,
                        retryCount,
                        error: webhookError.message
                    });
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return this.sendLogWebhook(guild, data, type, retryCount - 1);
                }

                // Fallback: salvar log localmente
                const fallbackPath = `./logs/webhooks/${guild.id}`;
                const fs = require('fs').promises;
                await fs.mkdir(fallbackPath, { recursive: true });
                
                const fallbackLog = {
                    timestamp: new Date().toISOString(),
                    type,
                    data,
                    error: webhookError.message
                };
                
                await fs.writeFile(
                    `${fallbackPath}/${Date.now()}_${type}.json`,
                    JSON.stringify(fallbackLog, null, 2)
                );
                
                logger.warn('Log salvo localmente após falha do webhook', {
                    guildId: guild.id,
                    ticketId: data.id
                });
            }
        } catch (error) {
            logger.error('Erro crítico ao processar webhook', {
                guildId: guild.id,
                error: error.message,
                data: JSON.stringify(data)
            });
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
                return await interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });
            }

            const hasPermission = await this.checkTicketPermissions(interaction.member, ticket);
            if (!hasPermission) {
                return await interaction.reply({ content: '❌ Você não tem permissão para fechar este ticket.', ephemeral: true });
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

            return await interaction.reply({ content: '✅ Ticket fechado com sucesso!' });

        } catch (error) {
            logger.error('Erro ao fechar ticket', { error: error.message, ticketId });
            return await interaction.reply({ content: '❌ Erro ao fechar ticket.', ephemeral: true });
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

module.exports = TicketSystem;
