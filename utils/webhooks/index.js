/**
 * 🔥 UNIFIED WEBHOOK SYSTEM - Index
 *
 * Sistema modular de webhooks com separação total entre:
 * - Tickets
 * - Giveaways
 * - Moderação
 * - Membros
 *
 * Cada sistema tem seus próprios handlers e logs independentes.
 */

const { unifiedWebhookSystem, EventTypes } = require('./UnifiedWebhookSystem');
const { ticketWebhookHandler } = require('./TicketWebhookHandler');
const { giveawayWebhookHandler } = require('./GiveawayWebhookHandler');

module.exports = {
    // Sistema principal
    webhookSystem: unifiedWebhookSystem,

    // Tipos de eventos
    EventTypes,

    // Handlers especializados
    ticketWebhooks: ticketWebhookHandler,
    giveawayWebhooks: giveawayWebhookHandler,

    // Funções de conveniência
    async configurarWebhook(guildId, eventType, webhookUrl, options) {
        return await unifiedWebhookSystem.setWebhook(guildId, eventType, webhookUrl, options);
    },

    async removerWebhook(guildId, eventType) {
        return await unifiedWebhookSystem.removeWebhook(guildId, eventType);
    },

    async toggleWebhook(guildId, eventType, enabled) {
        return await unifiedWebhookSystem.toggleWebhook(guildId, eventType, enabled);
    },

    getConfiguracao(guildId) {
        return unifiedWebhookSystem.getGuildConfig(guildId);
    },

    getEstatisticas() {
        return unifiedWebhookSystem.getStats();
    },

    async testarWebhook(guildId, eventType, userName) {
        return await unifiedWebhookSystem.testWebhook(guildId, eventType, userName);
    }
};
