const { WebhookClient, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class SimpleWebhookManager {
    constructor() {
        this.configPath = path.join(__dirname, '../config/webhooks.json');
        this.config = null;
    }

    // Carregar configuração SEMPRE que necessário (sem cache)
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
            // Sempre recarregar antes de salvar
            await this.loadConfig();
            
            await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
            logger.info('✅ Configuração de webhooks salva');
        } catch (error) {
            logger.error('❌ Erro ao salvar configuração de webhooks:', error);
        }
    }

    async getWebhookUrl(guildId) {
        await this.loadConfig(); // SEMPRE recarregar
        
        if (!this.config || !this.config.webhooks) return null;
        
        const guildConfig = this.config.webhooks[guildId];
        if (!guildConfig || !guildConfig.enabled || !guildConfig.webhookUrl) return null;
        
        // Verificar se não é placeholder
        if (guildConfig.webhookUrl.includes('SEU_WEBHOOK_URL')) return null;
        
        return guildConfig.webhookUrl;
    }

    async setWebhookUrl(guildId, webhookUrl) {
        await this.loadConfig(); // SEMPRE recarregar
        
        if (!this.config.webhooks) this.config.webhooks = {};
        
        if (!this.config.webhooks[guildId]) {
            this.config.webhooks[guildId] = {
                name: guildId === '1333820000791691284' ? 'YSNM COMMUNITY' : 'BEANNY',
                enabled: true
            };
        }
        
        this.config.webhooks[guildId].webhookUrl = webhookUrl;
        this.config.config.lastUpdated = new Date().toISOString();
        
        await this.saveConfig();
        logger.info(`✅ Webhook configurado para guild ${guildId}`);
    }

    async sendTicketLog(guildId, type, data) {
        try {
            const webhookUrl = await this.getWebhookUrl(guildId);
            
            if (!webhookUrl) {
                logger.warn(`⚠️ Webhook não configurado para guild ${guildId}`);
                return false;
            }

            const webhook = new WebhookClient({ url: webhookUrl });
            const guildName = this.config.webhooks[guildId]?.name || 'Unknown';

            // Criar embed baseado no tipo de evento
            let embed;
            let files = [];

            switch (type) {
                case 'create':
                    embed = this.createTicketCreateEmbed(data);
                    break;
                case 'update':
                case 'claim':
                    embed = this.createTicketUpdateEmbed(data);
                    break;
                case 'close':
                    embed = this.createTicketCloseEmbed(data);
                    // Adicionar transcript se disponível
                    if (data.transcript) {
                        files.push({
                            attachment: Buffer.from(data.transcript, 'utf8'),
                            name: `ticket-${data.ticketId || 'unknown'}-transcript.txt`
                        });
                    }
                    break;
                default:
                    embed = this.createGenericEmbed(data, type);
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

    createTicketCreateEmbed(data) {
        return new EmbedBuilder()
            .setTitle('🎫 Novo Ticket Criado')
            .setColor(0x4CAF50)
            .addFields(
                { name: '🆔 ID', value: `#${data.ticketId || 'N/A'}`, inline: true },
                { name: '👤 Autor', value: `<@${data.author?.id}> (${data.author?.tag})`, inline: true },
                { name: '📝 Categoria', value: data.category || 'Geral', inline: true },
                { name: '📅 Criado em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Sistema de Tickets' });
    }

    createTicketUpdateEmbed(data) {
        return new EmbedBuilder()
            .setTitle('🔄 Ticket Assumido')
            .setColor(0xFF9800)
            .addFields(
                { name: '🆔 ID', value: `#${data.ticketId || 'N/A'}`, inline: true },
                { name: '👤 Autor', value: `<@${data.author?.id}> (${data.author?.tag})`, inline: true },
                { name: '👨‍💼 Assumido por', value: `<@${data.claimedBy?.id}> (${data.claimedBy?.tag})`, inline: true },
                { name: '📅 Assumido em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Sistema de Tickets' });
    }

    createTicketCloseEmbed(data) {
        const embed = new EmbedBuilder()
            .setTitle('🔒 Ticket Fechado')
            .setColor(0xF44336)
            .addFields(
                { name: '🆔 ID', value: `#${data.ticketId || 'N/A'}`, inline: true },
                { name: '👤 Autor', value: `<@${data.author?.id}> (${data.author?.tag})`, inline: true },
                { name: '🔒 Fechado por', value: `<@${data.closedBy?.id}> (${data.closedBy?.tag})`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Sistema de Tickets' });

        // Adicionar informações extras se disponíveis
        if (data.claimedBy) {
            embed.addFields({ name: '👨‍💼 Foi assumido por', value: `<@${data.claimedBy.id}> (${data.claimedBy.tag})`, inline: true });
        }

        if (data.duration) {
            embed.addFields({ name: '⏱️ Duração', value: data.duration, inline: true });
        }

        if (data.reason) {
            embed.addFields({ name: '📋 Motivo', value: data.reason, inline: false });
        }

        if (data.transcript) {
            embed.addFields({ name: '📄 Transcript', value: 'Anexado como arquivo', inline: true });
        }

        return embed;
    }

    createGenericEmbed(data, type) {
        return new EmbedBuilder()
            .setTitle(`📋 Log: ${type}`)
            .setColor(0x2196F3)
            .setDescription(JSON.stringify(data, null, 2).substring(0, 4000))
            .setTimestamp()
            .setFooter({ text: 'Sistema de Logs' });
    }

    async testWebhook(guildId) {
        const testData = {
            ticketId: 'TEST-001',
            author: { id: '123456789', tag: 'TestUser#0001' },
            guild: { name: 'Test Server' }
        };

        return await this.sendTicketLog(guildId, 'create', testData);
    }

    getStatus() {
        if (!this.config) return { loaded: false };

        const guilds = Object.keys(this.config.webhooks || {});
        const configured = guilds.filter(guildId => {
            const config = this.config.webhooks[guildId];
            return config?.enabled && config?.webhookUrl && !config.webhookUrl.includes('SEU_WEBHOOK_URL');
        });

        return {
            loaded: true,
            totalGuilds: guilds.length,
            configuredGuilds: configured.length,
            guilds: this.config.webhooks
        };
    }
}

module.exports = SimpleWebhookManager;