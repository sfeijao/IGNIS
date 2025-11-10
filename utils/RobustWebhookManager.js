const { WebhookClient, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const { getUserDisplayName } = require('./userHelper');

class RobustWebhookManager {
    constructor() {
        this.configPath = path.join(__dirname, '../config/webhooks-config.json');
        this.config = null;
        this.webhookCache = new Map(); // Cache de webhooks válidos
    }

    async ensureConfigExists() {
        try {
            await fs.access(this.configPath);
        } catch (error) {
            // Arquivo não existe, criar um padrão
            const defaultConfig = {
                version: "2.0",
                created: new Date().toISOString(),
                webhooks: {},
                settings: {
                    enabledLogTypes: ["ticket_close", "ticket_create", "ticket_claim"],
                    includeTranscripts: true,
                    retryOnError: true,
                    maxRetries: 3
                }
            };
            await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
            logger.info('📁 Arquivo de configuração de webhooks criado');
        }
    }

    async loadConfig() {
        try {
            await this.ensureConfigExists();
            const data = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(data);

            // Migrar configuração antiga se necessário
            if (!this.config.version) {
                await this.migrateOldConfig();
            }

            return this.config;
        } catch (error) {
            logger.error('❌ Erro ao carregar configuração de webhooks:', error);
            throw new Error(`Falha ao carregar configuração: ${error.message}`);
        }
    }

    async saveConfig() {
        try {
            if (!this.config) {
                throw new Error('Configuração não carregada');
            }

            this.config.lastUpdated = new Date().toISOString();
            await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
            logger.info('✅ Configuração de webhooks salva com sucesso');
            return true;
        } catch (error) {
            logger.error('❌ Erro ao salvar configuração:', error);
            throw new Error(`Falha ao salvar: ${error.message}`);
        }
    }

    async migrateOldConfig() {
        logger.info('🔄 Migrando configuração antiga...');

        // Manter webhooks existentes, mas atualizar estrutura
        const oldWebhooks = this.config.webhooks || {};
        this.config = {
            version: "2.0",
            migrated: new Date().toISOString(),
            webhooks: {},
            settings: {
                enabledLogTypes: ["ticket_close", "ticket_create", "ticket_claim"],
                includeTranscripts: true,
                retryOnError: true,
                maxRetries: 3
            }
        };

        // Migrar webhooks antigos
        for (const [guildId, oldConfig] of Object.entries(oldWebhooks)) {
            if (oldConfig.webhookUrl && !oldConfig.webhookUrl.includes('SEU_WEBHOOK_URL')) {
                this.config.webhooks[guildId] = {
                    name: oldConfig.name || `Server ${guildId}`,
                    url: oldConfig.webhookUrl,
                    enabled: oldConfig.enabled !== false,
                    types: ["ticket_close"], // Manter apenas logs de fechamento por padrão
                    created: new Date().toISOString()
                };
            }
        }

        await this.saveConfig();
        logger.info('✅ Migração concluída');
    }

    validateWebhookUrl(url) {
        if (!url || typeof url !== 'string') {
            return { valid: false, error: 'URL é obrigatória' };
        }
        const discordWebhookRe = /^https:\/\/(ptb\.|canary\.)?discord\.com\/api\/webhooks\/|^https:\/\/discordapp\.com\/api\/webhooks\//;
        if (!discordWebhookRe.test(url)) {
            return { valid: false, error: 'URL deve ser um webhook do Discord' };
        }

        if (url.includes('SEU_WEBHOOK_URL') || url.length < 50) {
            return { valid: false, error: 'URL parece ser um placeholder ou inválida' };
        }

        return { valid: true };
    }

    async setWebhook(guildId, guildName, webhookUrl, logTypes = ['ticket_close']) {
        try {
            await this.loadConfig();

            // Validar URL
            const validation = this.validateWebhookUrl(webhookUrl);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Testar webhook antes de salvar
            const testResult = await this.testWebhookConnection(webhookUrl);
            if (!testResult.success) {
                throw new Error(`Webhook inválido: ${testResult.error}`);
            }

            // Salvar configuração
            this.config.webhooks[guildId] = {
                name: guildName || `Server ${guildId}`,
                url: webhookUrl,
                enabled: true,
                types: Array.isArray(logTypes) ? logTypes : ['ticket_close'],
                created: new Date().toISOString(),
                tested: new Date().toISOString()
            };

            await this.saveConfig();

            // Limpar cache
            this.webhookCache.delete(guildId);

            logger.info(`✅ Webhook configurado para ${guildName} (${guildId})`);
            return { success: true };

        } catch (error) {
            logger.error('❌ Erro ao configurar webhook:', error);
            return { success: false, error: error.message };
        }
    }

    async getWebhook(guildId) {
        try {
            await this.loadConfig();
            const webhookConfig = this.config.webhooks[guildId];

            if (!webhookConfig || !webhookConfig.enabled || !webhookConfig.url) {
                return null;
            }

            return webhookConfig;
        } catch (error) {
            logger.error('❌ Erro ao buscar webhook:', error);
            return null;
        }
    }

    async testWebhookConnection(webhookUrl) {
        try {
            const webhook = new WebhookClient({ url: webhookUrl });

            // Tentar fazer fetch do webhook para validar
            await webhook.fetchMessage('@original').catch(() => {
                // Isso é esperado falhar, mas valida se o webhook existe
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async sendLog(guildId, logType, data) {
        try {
            const webhookConfig = await this.getWebhook(guildId);

            if (!webhookConfig) {
                logger.debug(`⏩ Webhook não configurado para guild ${guildId}`);
                return { success: false, reason: 'not_configured' };
            }

            if (!webhookConfig.types.includes(logType)) {
                logger.debug(`⏩ Tipo '${logType}' não habilitado para guild ${guildId}`);
                return { success: false, reason: 'type_disabled' };
            }

            const webhook = new WebhookClient({ url: webhookConfig.url });
            const embed = this.createLogEmbed(logType, data);

            const payload = {
                embeds: [embed],
                username: `${webhookConfig.name} Logs`,
                avatarURL: data.guild?.iconURL?.() || undefined
            };

            // Adicionar arquivo se necessário
            if (data.transcript && logType === 'ticket_close') {
                payload.files = [{
                    attachment: Buffer.from(data.transcript, 'utf8'),
                    name: `ticket-${data.sequentialId || Date.now()}-transcript.txt`
                }];
            }

            await webhook.send(payload);

            logger.info(`📨 Log '${logType}' enviado para ${webhookConfig.name}`);
            return { success: true };

        } catch (error) {
            logger.error(`❌ Erro ao enviar log '${logType}':`, error);

            // Retry se configurado
            if (this.config.settings.retryOnError) {
                // Implementar retry aqui se necessário
            }

            return { success: false, error: error.message };
        }
    }

    createLogEmbed(logType, data) {
        const embed = new EmbedBuilder()
            .setTimestamp()
            .setFooter({ text: 'IGNIS Ticket System' });

        switch (logType) {
            case 'ticket_close':
                return embed
                    .setTitle('🔒 Ticket Fechado')
                    .setColor(0xF44336)
                    .addFields(
                        { name: '🎫 ID', value: `#${data.sequentialId || 'N/A'}`, inline: true },
                        { name: '🆔 Canal', value: `\`${data.channelId}\``, inline: true },
                        { name: '🏷️ Servidor', value: data.guild?.name || 'Desconhecido', inline: true },
                        { name: '👤 Criado por', value: getUserDisplayName(data.author, data.guild) || 'Desconhecido', inline: true },
                        { name: '🔒 Fechado por', value: getUserDisplayName(data.closedBy, data.guild) || 'Desconhecido', inline: true },
                        { name: '📅 Fechado em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                    );

            case 'ticket_create':
                return embed
                    .setTitle('🎫 Novo Ticket')
                    .setColor(0x4CAF50)
                    .addFields(
                        { name: '🎫 ID', value: `#${data.sequentialId || 'N/A'}`, inline: true },
                        { name: '👤 Criado por', value: getUserDisplayName(data.author, data.guild) || 'Desconhecido', inline: true },
                        { name: '📁 Categoria', value: data.category || 'Geral', inline: true }
                    );

            case 'ticket_claim':
                return embed
                    .setTitle('👨‍💼 Ticket Assumido')
                    .setColor(0xFF9800)
                    .addFields(
                        { name: '🎫 ID', value: `#${data.sequentialId || 'N/A'}`, inline: true },
                        { name: '👤 Assumido por', value: getUserDisplayName(data.claimedBy, data.guild) || 'Desconhecido', inline: true }
                    );

            default:
                return embed
                    .setTitle('📋 Log do Sistema')
                    .setColor(0x2196F3)
                    .setDescription(`Tipo: ${logType}`);
        }
    }

    async getStatus(guildId) {
        try {
            await this.loadConfig();
            const webhook = this.config.webhooks[guildId];

            return {
                configured: !!webhook,
                enabled: webhook?.enabled || false,
                url: webhook?.url || null,
                types: webhook?.types || [],
                name: webhook?.name || null,
                created: webhook?.created || null,
                tested: webhook?.tested || null
            };
        } catch (error) {
            logger.error('Erro ao buscar status:', error);
            return { configured: false, error: error.message };
        }
    }

    async removeWebhook(guildId) {
        try {
            await this.loadConfig();

            if (this.config.webhooks[guildId]) {
                delete this.config.webhooks[guildId];
                await this.saveConfig();
                this.webhookCache.delete(guildId);
                logger.info(`✅ Webhook removido para guild ${guildId}`);
                return { success: true };
            }

            return { success: false, error: 'Webhook não encontrado' };
        } catch (error) {
            logger.error('Erro ao remover webhook:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = RobustWebhookManager;
