const { WebhookClient, EmbedBuilder } = require('discord.js');
const logger = require('./logger');

/**
 * ✨ ADVANCED WEBHOOK MANAGER - Single Message Updates
 * 
 * Envia 1 mensagem por ticket e atualiza via PATCH (não spam).
 * - POST: Cria mensagem inicial
 * - PATCH: Atualiza mensagem existente
 * - Queue: Previne rate limiting
 * - Rich Embeds: Timeline de eventos
 */

class AdvancedWebhookManager {
  constructor() {
    this.webhooks = new Map(); // guildId -> WebhookClient
    this.updateQueue = []; // Fila de updates pendentes
    this.processing = false;
    this.retryDelay = 2000; // 2s entre retries
    this.maxRetries = 3;
  }

  /**
   * Configurar webhook para guild
   */
  setWebhook(guildId, webhookUrl) {
    if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      logger.warn(`[AdvancedWebhook] Invalid webhook URL for guild ${guildId}`);
      return false;
    }

    try {
      const client = new WebhookClient({ url: webhookUrl });
      this.webhooks.set(guildId, client);
      logger.info(`[AdvancedWebhook] Configured for guild ${guildId}`);
      return true;
    } catch (error) {
      logger.error(`[AdvancedWebhook] Failed to create webhook client:`, error);
      return false;
    }
  }

  /**
   * Remover webhook
   */
  removeWebhook(guildId) {
    this.webhooks.delete(guildId);
    logger.info(`[AdvancedWebhook] Removed webhook for guild ${guildId}`);
  }

  /**
   * Criar embed rico com timeline
   */
  createTicketEmbed(ticketData, eventType = 'created') {
    const { id, guild, user, category, subject, description, status, priority, created_at, assigned_to, closed_at, timeline = [] } = ticketData;

    // Cores por status
    const colors = {
      created: 0x3B82F6, // Azul
      claimed: 0xF59E0B, // Amarelo
      updated: 0xA78BFA, // Roxo
      closed: 0x10B981  // Verde
    };

    const embed = new EmbedBuilder()
      .setColor(colors[eventType] || colors.created)
      .setTitle(`🎫 Ticket #${id}`)
      .setDescription(subject || 'Sem assunto')
      .setTimestamp();

    // Campos principais
    embed.addFields(
      { name: '👤 Utilizador', value: user ? `<@${user.id}>` : 'Desconhecido', inline: true },
      { name: '📂 Categoria', value: category || 'Geral', inline: true },
      { name: '📊 Status', value: this.getStatusEmoji(status) + ' ' + (status || 'open'), inline: true }
    );

    if (priority && priority !== 'normal') {
      embed.addFields({ name: '⚡ Prioridade', value: priority.toUpperCase(), inline: true });
    }

    if (assigned_to) {
      embed.addFields({ name: '👨‍💼 Atribuído', value: `<@${assigned_to}>`, inline: true });
    }

    if (description) {
      embed.addFields({ name: '📝 Descrição', value: description.slice(0, 1024), inline: false });
    }

    // Timeline de eventos
    if (timeline.length > 0) {
      const timelineText = timeline
        .slice(-5) // Últimos 5 eventos
        .map(e => `• <t:${Math.floor(new Date(e.timestamp).getTime() / 1000)}:R> - ${e.action}`)
        .join('\n');
      embed.addFields({ name: '📋 Timeline', value: timelineText || 'Sem eventos', inline: false });
    }

    // Timestamp de criação/fechamento
    if (created_at) {
      embed.setFooter({ text: `Criado ${new Date(created_at).toLocaleString()}` });
    }

    if (closed_at) {
      embed.addFields({ name: '🏁 Fechado', value: `<t:${Math.floor(new Date(closed_at).getTime() / 1000)}:R>`, inline: true });
    }

    return embed;
  }

  /**
   * Emojis por status
   */
  getStatusEmoji(status) {
    const emojis = {
      open: '🟢',
      claimed: '🟡',
      pending: '🟣',
      closed: '✅'
    };
    return emojis[status] || '⚪';
  }

  /**
   * Enviar mensagem inicial (POST)
   */
  async sendInitialMessage(guildId, ticketData) {
    const webhook = this.webhooks.get(guildId);
    if (!webhook) {
      logger.debug(`[AdvancedWebhook] No webhook configured for guild ${guildId}`);
      return null;
    }

    try {
      const embed = this.createTicketEmbed(ticketData, 'created');
      
      const message = await webhook.send({
        embeds: [embed],
        username: 'IGNIS Tickets',
        avatarURL: 'https://cdn.discordapp.com/embed/avatars/0.png'
      });

      logger.info(`[AdvancedWebhook] Initial message sent for ticket #${ticketData.id} (msg: ${message.id})`);
      return message.id; // Retornar ID para salvar no DB

    } catch (error) {
      logger.error(`[AdvancedWebhook] Failed to send initial message:`, error);
      return null;
    }
  }

  /**
   * Atualizar mensagem existente (PATCH)
   */
  async updateMessage(guildId, messageId, ticketData, eventType = 'updated') {
    const webhook = this.webhooks.get(guildId);
    if (!webhook || !messageId) {
      logger.debug(`[AdvancedWebhook] Cannot update: webhook or messageId missing`);
      return false;
    }

    // Adicionar à fila ao invés de executar imediatamente
    this.updateQueue.push({ guildId, messageId, ticketData, eventType, retries: 0 });
    
    if (!this.processing) {
      this.processQueue();
    }

    return true;
  }

  /**
   * Processar fila de updates (previne rate limiting)
   */
  async processQueue() {
    if (this.processing || this.updateQueue.length === 0) return;

    this.processing = true;

    while (this.updateQueue.length > 0) {
      const update = this.updateQueue.shift();
      const { guildId, messageId, ticketData, eventType, retries } = update;

      const webhook = this.webhooks.get(guildId);
      if (!webhook) continue;

      try {
        const embed = this.createTicketEmbed(ticketData, eventType);

        await webhook.editMessage(messageId, {
          embeds: [embed]
        });

        logger.info(`[AdvancedWebhook] Updated message ${messageId} for ticket #${ticketData.id}`);

        // Delay entre updates para evitar rate limit
        await this.sleep(1000);

      } catch (error) {
        logger.error(`[AdvancedWebhook] Failed to update message ${messageId}:`, error);

        // Retry com backoff exponencial
        if (retries < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retries);
          logger.warn(`[AdvancedWebhook] Retrying in ${delay}ms (attempt ${retries + 1}/${this.maxRetries})`);
          
          await this.sleep(delay);
          this.updateQueue.push({ guildId, messageId, ticketData, eventType, retries: retries + 1 });
        } else {
          logger.error(`[AdvancedWebhook] Max retries reached for message ${messageId}`);
        }
      }
    }

    this.processing = false;
  }

  /**
   * Helper: Sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Enviar ou atualizar (auto-detecta)
   */
  async sendOrUpdate(guildId, ticketData, eventType = 'updated') {
    const webhook = this.webhooks.get(guildId);
    if (!webhook) return null;

    // Se já tem webhook_message_id, atualizar
    if (ticketData.webhook_message_id) {
      await this.updateMessage(guildId, ticketData.webhook_message_id, ticketData, eventType);
      return ticketData.webhook_message_id;
    }

    // Senão, enviar nova mensagem
    const messageId = await this.sendInitialMessage(guildId, ticketData);
    return messageId;
  }

  /**
   * Obter estatísticas da fila
   */
  getQueueStats() {
    return {
      pending: this.updateQueue.length,
      processing: this.processing,
      configured_guilds: this.webhooks.size
    };
  }
}

// Singleton
const advancedWebhookManager = new AdvancedWebhookManager();

module.exports = {
  AdvancedWebhookManager,
  advancedWebhookManager
};
