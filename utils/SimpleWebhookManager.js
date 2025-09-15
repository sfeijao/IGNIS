const { WebhookClient, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const { getUserDisplayName } = require('./userHelper');

class SimpleWebhookManager {
    constructor() {
        this.configPath = path.join(__dirname, '../config/webhooks.json');
        this.config = null;
    }

    async loadConfig() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(data);
            return this.config;
        } catch (error) {
            logger.error('❌ Erro ao carregar configuração de webhooks:', error);
            this.config = { webhooks: {}, logTypes: {}, config: {} };
            return this.config;
        }
    }

    async saveConfig() {
        try {
            await this.loadConfig();
            await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
            logger.info('✅ Configuração de webhooks salva');
        } catch (error) {
            logger.error('❌ Erro ao salvar configuração de webhooks:', error);
        }
    }

    async getWebhookUrl(guildId) {
        await this.loadConfig();
        
        if (!this.config || !this.config.webhooks) return null;
        
        const guildConfig = this.config.webhooks[guildId];
        if (!guildConfig || !guildConfig.enabled || !guildConfig.webhookUrl) return null;
        
        if (guildConfig.webhookUrl.includes('SEU_WEBHOOK_URL')) return null;
        
        return guildConfig.webhookUrl;
    }

    async setWebhookUrl(guildId, webhookUrl) {
        await this.loadConfig();
        
        if (!this.config.webhooks) this.config.webhooks = {};
        
        if (webhookUrl === null) {
            // Remover webhook
            if (this.config.webhooks[guildId]) {
                delete this.config.webhooks[guildId];
                if (!this.config.config) this.config.config = {};
                this.config.config.lastUpdated = new Date().toISOString();
                await this.saveConfig();
                logger.info(`✅ Webhook removido para guild ${guildId}`);
            }
            return;
        }
        
        if (!this.config.webhooks[guildId]) {
            this.config.webhooks[guildId] = {
                name: guildId === '1333820000791691284' ? 'IGNIS COMMUNITY' : 'BEANNY',
                enabled: true
            };
        }
        
        this.config.webhooks[guildId].webhookUrl = webhookUrl;
        if (!this.config.config) this.config.config = {};
        this.config.config.lastUpdated = new Date().toISOString();
        
        await this.saveConfig();
        logger.info(`✅ Webhook configurado para guild ${guildId}`);
    }

    async sendTicketLog(guildId, type, data) {
        try {
            if (type !== 'close') {
                logger.debug(`⏩ Ignorando log de tipo '${type}' - apenas logs de fechamento são enviados`);
                return false;
            }

            const webhookUrl = await this.getWebhookUrl(guildId);
            
            if (!webhookUrl) {
                logger.warn(`⚠️ Webhook não configurado para guild ${guildId}`);
                return false;
            }

            const webhook = new WebhookClient({ url: webhookUrl });
            const guildName = this.config.webhooks[guildId]?.name || 'Unknown';

            const embed = this.createTicketCloseEmbed(data);
            let files = [];
                    
            if (data.transcript) {
                files.push({
                    attachment: Buffer.from(data.transcript, 'utf8'),
                    name: `ticket-${data.sequentialId || data.ticketId}-transcript.txt`
                });
            }

            const webhookData = {
                embeds: [embed],
                username: `${guildName} Tickets`,
                avatarURL: data.guild?.iconURL?.() || undefined
            };

            if (files.length > 0) {
                webhookData.files = files;
            }

            await webhook.send(webhookData);
            
            logger.info(`📨 Log de ticket enviado: ${type} para ${guildName}`);
            return true;

        } catch (error) {
            logger.error('❌ Erro ao enviar log de ticket:', error);
            return false;
        }
    }

    createTicketCloseEmbed(data) {
        const authorDisplayName = getUserDisplayName(data.author, data.guild);
        const closedByDisplayName = getUserDisplayName(data.closedBy, data.guild);
        
        const embed = new EmbedBuilder()
            .setTitle('🔒 Ticket Fechado')
            .setColor(0xF44336)
            .addFields(
                { name: '🎫 ID Sequencial', value: `#${data.sequentialId || 'N/A'}`, inline: true },
                { name: '🆔 ID do Canal', value: `\`${data.channelId || 'N/A'}\``, inline: true },
                { name: '🏷️ Servidor', value: data.guild?.name || 'Desconhecido', inline: true },
                { name: '👤 Autor do Ticket', value: `<@${data.author?.id}> (${authorDisplayName})`, inline: true },
                { name: '🔒 Fechado por', value: `<@${data.closedBy?.id}> (${closedByDisplayName})`, inline: true },
                { name: '📅 Data de Fechamento', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Sistema de Tickets IGNIS' });

        if (data.claimedBy) {
            const claimedByDisplayName = getUserDisplayName(data.claimedBy, data.guild);
            embed.addFields({ name: '👨‍💼 Foi assumido por', value: `<@${data.claimedBy.id}> (${claimedByDisplayName})`, inline: true });
        }

        if (data.duration) {
            embed.addFields({ name: '⏱️ Duração', value: data.duration, inline: true });
        }

        if (data.reason) {
            embed.addFields({ name: '📝 Motivo', value: data.reason, inline: false });
        }

        if (data.transcript) {
            embed.addFields({ name: '📎 Transcript', value: 'Arquivo anexado com transcrição completa', inline: false });
        }

        return embed;
    }

    async testWebhook(guildId) {
        const testData = {
            author: { id: '123456789', tag: 'TestUser#1234' },
            closedBy: { id: '987654321', tag: 'Admin#0001' },
            sequentialId: 999,
            channelId: '123456789123456789',
            guild: { name: 'Servidor de Teste' },
            duration: '2h 30m',
            reason: 'Teste do webhook',
            transcript: 'Esta é uma transcrição de teste...'
        };

        return await this.sendTicketLog(guildId, 'close', testData);
    }
}

module.exports = SimpleWebhookManager;