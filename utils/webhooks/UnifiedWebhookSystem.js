const { WebhookClient, EmbedBuilder } = require('discord.js');
const logger = require('../logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * 🔥 UNIFIED WEBHOOK SYSTEM
 *
 * Sistema modular e robusto de webhooks com:
 * - Separação por tipo de evento (tickets, giveaways, moderation, etc)
 * - Fila de processamento para evitar rate limiting
 * - Retry automático com backoff exponencial
 * - Fallback para logs locais em caso de falha
 * - Ativar/desativar logs por tipo no dashboard
 * - Suporte para atualização de mensagens únicas (PATCH)
 */

class UnifiedWebhookSystem {
    constructor() {
        this.configPath = path.join(__dirname, '../../data/webhooks.json');
        this.config = {}; // guildId -> { eventType -> { url, enabled, messageTracking } }
        this.clients = new Map(); // webhookUrl -> WebhookClient
        this.messageQueue = []; // Fila de mensagens pendentes
        this.processing = false;
        this.retryDelay = 2000; // 2s base delay
        this.maxRetries = 3;
        this.rateLimit = 1000; // 1s entre mensagens

        // Tipos de eventos suportados
        this.eventTypes = {
            TICKET_CREATE: 'ticket_create',
            TICKET_CLAIM: 'ticket_claim',
            TICKET_CLOSE: 'ticket_close',
            TICKET_UPDATE: 'ticket_update',
            GIVEAWAY_CREATE: 'giveaway_create',
            GIVEAWAY_END: 'giveaway_end',
            GIVEAWAY_WINNER: 'giveaway_winner',
            MODERATION_WARN: 'moderation_warn',
            MODERATION_KICK: 'moderation_kick',
            MODERATION_BAN: 'moderation_ban',
            MEMBER_JOIN: 'member_join',
            MEMBER_LEAVE: 'member_leave'
        };

        this.load();
    }

    /**
     * Carregar configurações do arquivo
     */
    async load() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(data);
            logger.info('[UnifiedWebhook] Configurações carregadas com sucesso');
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.info('[UnifiedWebhook] Criando arquivo de configuração inicial');
                this.config = {};
                await this.save();
            } else {
                logger.error('[UnifiedWebhook] Erro ao carregar configurações:', error);
                this.config = {};
            }
        }
    }

    /**
     * Salvar configurações no arquivo
     */
    async save() {
        try {
            await fs.mkdir(path.dirname(this.configPath), { recursive: true });
            await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
            logger.debug('[UnifiedWebhook] Configurações salvas');
        } catch (error) {
            logger.error('[UnifiedWebhook] Erro ao salvar configurações:', error);
        }
    }

    /**
     * Configurar webhook para um tipo de evento
     */
    async setWebhook(guildId, eventType, webhookUrl, options = {}) {
        if (!this.isValidEventType(eventType)) {
            logger.warn(`[UnifiedWebhook] Tipo de evento inválido: ${eventType}`);
            return false;
        }

        if (!this.isValidWebhookUrl(webhookUrl)) {
            logger.warn(`[UnifiedWebhook] URL de webhook inválida: ${webhookUrl}`);
            return false;
        }

        // Inicializar configuração da guild se não existir
        if (!this.config[guildId]) {
            this.config[guildId] = {};
        }

        // Configurar webhook
        this.config[guildId][eventType] = {
            url: webhookUrl,
            enabled: options.enabled !== false, // Ativado por padrão
            updateMode: options.updateMode || 'new', // 'new' ou 'update' (PATCH)
            messageTracking: {}, // ticketId -> messageId (para updates)
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await this.save();
        logger.info(`[UnifiedWebhook] Webhook configurado: Guild ${guildId}, Event ${eventType}`);
        return true;
    }

    /**
     * Remover webhook de um tipo de evento
     */
    async removeWebhook(guildId, eventType) {
        if (this.config[guildId]?.[eventType]) {
            delete this.config[guildId][eventType];
            await this.save();
            logger.info(`[UnifiedWebhook] Webhook removido: Guild ${guildId}, Event ${eventType}`);
            return true;
        }
        return false;
    }

    /**
     * Ativar/desativar webhook
     */
    async toggleWebhook(guildId, eventType, enabled) {
        if (this.config[guildId]?.[eventType]) {
            this.config[guildId][eventType].enabled = enabled;
            this.config[guildId][eventType].updatedAt = new Date().toISOString();
            await this.save();
            logger.info(`[UnifiedWebhook] Webhook ${enabled ? 'ativado' : 'desativado'}: Guild ${guildId}, Event ${eventType}`);
            return true;
        }
        return false;
    }

    /**
     * Obter cliente de webhook (cached)
     */
    getWebhookClient(webhookUrl) {
        if (!this.clients.has(webhookUrl)) {
            try {
                const client = new WebhookClient({ url: webhookUrl });
                this.clients.set(webhookUrl, client);
            } catch (error) {
                logger.error('[UnifiedWebhook] Erro ao criar cliente de webhook:', error);
                return null;
            }
        }
        return this.clients.get(webhookUrl);
    }

    /**
     * Enviar mensagem via webhook (adiciona à fila)
     */
    async send(guildId, eventType, payload, options = {}) {
        // Verificar se webhook está configurado e ativado
        const webhookConfig = this.config[guildId]?.[eventType];
        if (!webhookConfig || !webhookConfig.enabled) {
            logger.debug(`[UnifiedWebhook] Webhook não configurado ou desativado: Guild ${guildId}, Event ${eventType}`);
            return false;
        }

        // Adicionar à fila
        this.messageQueue.push({
            guildId,
            eventType,
            payload,
            options,
            retries: 0,
            timestamp: Date.now()
        });

        // Iniciar processamento se não estiver rodando
        if (!this.processing) {
            this.processQueue();
        }

        return true;
    }

    /**
     * Processar fila de mensagens
     */
    async processQueue() {
        if (this.processing || this.messageQueue.length === 0) {
            return;
        }

        this.processing = true;
        logger.debug(`[UnifiedWebhook] Iniciando processamento de fila (${this.messageQueue.length} mensagens)`);

        while (this.messageQueue.length > 0) {
            const item = this.messageQueue.shift();
            const { guildId, eventType, payload, options, retries } = item;

            const webhookConfig = this.config[guildId]?.[eventType];
            if (!webhookConfig) {
                logger.warn(`[UnifiedWebhook] Webhook não encontrado durante processamento: ${guildId}/${eventType}`);
                continue;
            }

            const client = this.getWebhookClient(webhookConfig.url);
            if (!client) {
                logger.error(`[UnifiedWebhook] Cliente de webhook inválido: ${webhookConfig.url}`);
                await this.saveFallbackLog(guildId, eventType, payload, 'Invalid webhook client');
                continue;
            }

            try {
                // Verificar se deve atualizar mensagem existente
                const trackingId = options.trackingId; // e.g., ticketId para tickets
                const existingMessageId = trackingId ? webhookConfig.messageTracking[trackingId] : null;

                if (existingMessageId && webhookConfig.updateMode === 'update') {
                    // Atualizar mensagem existente (PATCH)
                    await client.editMessage(existingMessageId, payload);
                    logger.info(`[UnifiedWebhook] Mensagem atualizada: ${existingMessageId} (${eventType})`);
                } else {
                    // Enviar nova mensagem (POST)
                    const message = await client.send(payload);

                    // Salvar messageId para futuros updates
                    if (trackingId && webhookConfig.updateMode === 'update') {
                        webhookConfig.messageTracking[trackingId] = message.id;
                        await this.save();
                    }

                    logger.info(`[UnifiedWebhook] Mensagem enviada: ${message.id} (${eventType})`);
                }

                // Delay para evitar rate limit
                await this.sleep(this.rateLimit);

            } catch (error) {
                logger.error(`[UnifiedWebhook] Erro ao enviar/atualizar mensagem (${eventType}):`, error);

                // Retry com backoff exponencial
                if (retries < this.maxRetries) {
                    const delay = this.retryDelay * Math.pow(2, retries);
                    logger.warn(`[UnifiedWebhook] Tentando novamente em ${delay}ms (tentativa ${retries + 1}/${this.maxRetries})`);

                    await this.sleep(delay);
                    item.retries = retries + 1;
                    this.messageQueue.unshift(item); // Re-adicionar no início da fila
                } else {
                    // Max retries atingido, salvar em fallback
                    logger.error(`[UnifiedWebhook] Máximo de tentativas atingido para ${eventType}`);
                    await this.saveFallbackLog(guildId, eventType, payload, error.message);
                }
            }
        }

        this.processing = false;
        logger.debug('[UnifiedWebhook] Processamento de fila concluído');
    }

    /**
     * Salvar log em fallback (arquivo local) quando webhook falha
     */
    async saveFallbackLog(guildId, eventType, payload, errorMessage) {
        try {
            const fallbackDir = path.join(__dirname, '../../logs/webhook-fallback', guildId);
            await fs.mkdir(fallbackDir, { recursive: true });

            const filename = `${Date.now()}_${eventType}.json`;
            const filepath = path.join(fallbackDir, filename);

            const fallbackData = {
                timestamp: new Date().toISOString(),
                guildId,
                eventType,
                payload,
                error: errorMessage
            };

            await fs.writeFile(filepath, JSON.stringify(fallbackData, null, 2));
            logger.info(`[UnifiedWebhook] Log salvo em fallback: ${filepath}`);
        } catch (error) {
            logger.error('[UnifiedWebhook] Erro ao salvar fallback log:', error);
        }
    }

    /**
     * Obter configuração de webhooks de uma guild
     */
    getGuildConfig(guildId) {
        return this.config[guildId] || {};
    }

    /**
     * Obter estatísticas do sistema
     */
    getStats() {
        return {
            queueSize: this.messageQueue.length,
            processing: this.processing,
            totalGuilds: Object.keys(this.config).length,
            totalClients: this.clients.size,
            eventTypes: Object.keys(this.eventTypes).length
        };
    }

    /**
     * Validações
     */
    isValidEventType(eventType) {
        return Object.values(this.eventTypes).includes(eventType);
    }

    isValidWebhookUrl(url) {
        return url && typeof url === 'string' && url.startsWith('https://discord.com/api/webhooks/');
    }

    /**
     * Utilidades
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Testar webhook
     */
    async testWebhook(guildId, eventType, userName = 'Sistema') {
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Teste de Webhook')
            .setDescription('Esta é uma mensagem de teste do sistema de webhooks.')
            .addFields(
                { name: '🆔 Guild ID', value: guildId, inline: true },
                { name: '📡 Tipo de Evento', value: eventType, inline: true },
                { name: '👤 Testado por', value: userName, inline: true }
            )
            .setTimestamp();

        return await this.send(guildId, eventType, { embeds: [embed] });
    }
}

// Singleton
const unifiedWebhookSystem = new UnifiedWebhookSystem();

module.exports = {
    UnifiedWebhookSystem,
    unifiedWebhookSystem,
    EventTypes: unifiedWebhookSystem.eventTypes
};
