/**
 * Sistema de Webhooks - Gestão e Envio
 * Gerencia webhooks externos para logs de tickets, moderação, etc.
 *
 * DEPRECATED: Este arquivo mantém compatibilidade com código legado.
 * Use o novo sistema em utils/webhooks/UnifiedWebhookSystem.js
 */

const { unifiedWebhookSystem, EventTypes } = require('./webhooks');
const logger = require('./logger');

class WebhookManager {
  constructor() {
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 1000; // 1 segundo
    logger.warn('[WebhookSystem] Usando wrapper de compatibilidade. Migre para UnifiedWebhookSystem.');
  }

  /**
   * Envia ou atualiza webhook de ticket
   * WRAPPER para compatibilidade - delega para novo sistema
   */
  async sendOrUpdateTicketWebhook(ticket, event, data = {}) {
    try {
      const guildId = ticket.guild_id;

      // Usar o novo sistema unificado
      const { ticketWebhooks } = require('./webhooks');

      switch (event) {
        case 'created':
          return await ticketWebhooks.logCreate(guildId, ticket);
        case 'claimed':
          return await ticketWebhooks.logClaim(guildId, ticket, data.claimer || data.claimedBy);
        case 'closed':
          return await ticketWebhooks.logClose(guildId, ticket, data.closer, data.reason, data.transcript);
        case 'reopened':
          return await ticketWebhooks.logUpdate(guildId, ticket, { status: { old: 'closed', new: 'open' } }, data.updater || data.reopenedBy);
        case 'renamed':
          return await ticketWebhooks.logUpdate(guildId, ticket, { name: { old: ticket.channel_name, new: data.newName } }, data.updater || data.renamedBy);
        default:
          logger.warn(`[WebhookSystem] Evento não mapeado: ${event}`);
          return null;
      }
    } catch (error) {
      logger.error('[WebhookSystem] Erro em sendOrUpdateTicketWebhook:', error);
      return null;
    }
  }

  /**
   * Teste de webhook
   */
  async testWebhook(url) {
    try {
      return await unifiedWebhookSystem.testWebhook(url);
    } catch (error) {
      logger.error('[WebhookSystem] Erro ao testar webhook:', error);
      return false;
    }
  }
}

module.exports = new WebhookManager();
