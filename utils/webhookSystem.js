/**
 * Sistema de Webhooks - Gestão e Envio
 * Gerencia webhooks externos para logs de tickets, moderação, etc.
 */

const { WebhookConfigModel, TicketWebhookLogModel } = require('./db/models');
const fetch = require('node-fetch');

class WebhookManager {
  constructor() {
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 1000; // 1 segundo
  }

  /**
   * Envia ou atualiza webhook de ticket
   */
  async sendOrUpdateTicketWebhook(ticket, event, data = {}) {
    try {
      const webhookConfig = await WebhookConfigModel.findOne({ guildId: ticket.guild_id });
      
      // Verificar se webhooks de tickets estão habilitados
      if (!webhookConfig || !webhookConfig.logsEnabled.tickets) {
        return null;
      }

      // Obter webhooks configurados para tickets
      const ticketWebhooks = webhookConfig.getWebhooksByType('tickets');
      if (ticketWebhooks.length === 0) {
        return null;
      }

      const results = [];
      
      for (const webhook of ticketWebhooks) {
        try {
          // Verificar se já existe log para este ticket e webhook
          let log = await TicketWebhookLogModel.findOne({
            ticketId: ticket.id,
            webhookUrl: webhook.url
          });

          const embed = this.buildTicketEmbed(ticket, event, data);
          const payload = { embeds: [embed] };

          if (!log) {
            // Primeira mensagem - criar nova
            const response = await this.sendWebhook(webhook.url, payload);
            
            if (response && response.ok) {
              try {
                const text = await response.text();
                if (!text) {
                  console.error(`Webhook ${webhook.name} retornou resposta vazia - provavelmente foi deletado`);
                  results.push({ success: false, webhook: webhook.name, error: 'Webhook inválido ou deletado' });
                  continue;
                }
                
                const messageData = JSON.parse(text);
                log = await TicketWebhookLogModel.create({
                  ticketId: ticket.id,
                  guildId: ticket.guild_id,
                  webhookUrl: webhook.url,
                  webhookName: webhook.name,
                  messageId: messageData.id,
                  threadId: messageData.thread_id,
                  status: 'sent'
                });
                
                await log.addEvent(event, data);
                results.push({ success: true, webhook: webhook.name, action: 'created' });
              } catch (parseError) {
                console.error(`Erro ao processar resposta do webhook ${webhook.name}:`, parseError);
                results.push({ success: false, webhook: webhook.name, error: 'Resposta inválida do Discord' });
              }
            } else {
              results.push({ success: false, webhook: webhook.name, error: `HTTP ${response?.status || 'erro'}` });
            }
          } else {
            // Atualizar mensagem existente
            const updated = await this.updateWebhookMessage(
              webhook.url,
              log.messageId,
              payload
            );
            
            if (updated) {
              await log.addEvent(event, data);
              log.status = 'updated';
              await log.save();
              results.push({ success: true, webhook: webhook.name, action: 'updated' });
            }
          }
        } catch (webhookError) {
          console.error(`Erro no webhook ${webhook.name}:`, webhookError);
          results.push({ 
            success: false, 
            webhook: webhook.name, 
            error: webhookError.message 
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Erro geral em sendOrUpdateTicketWebhook:', error);
      return null;
    }
  }

  /**
   * Anexa transcrição ao webhook do ticket
   */
  async attachTranscript(ticketId, guildId, transcriptUrl, transcriptContent) {
    try {
      const logs = await TicketWebhookLogModel.find({ ticketId, guildId });
      
      for (const log of logs) {
        try {
          // Opção 1: Editar a mensagem com link para transcrição
          const webhookConfig = await WebhookConfigModel.findOne({ guildId });
          const webhook = webhookConfig?.webhooks.find(w => w.url === log.webhookUrl);
          
          if (!webhook) continue;

          const payload = {
            content: `📄 **Transcrição anexada**\n${transcriptUrl || 'Transcrição disponível'}`,
            embeds: [{
              title: '📋 Transcrição do Ticket',
              description: transcriptContent ? 
                transcriptContent.substring(0, 2000) + (transcriptContent.length > 2000 ? '...' : '') :
                'Transcrição completa disponível',
              color: 0x5865F2,
              timestamp: new Date().toISOString(),
              footer: { text: `Ticket ID: ${ticketId}` }
            }]
          };

          // Responder à mensagem original com a transcrição
          await this.sendWebhook(log.webhookUrl, {
            ...payload,
            thread_id: log.threadId
          });

          log.transcriptAttached = true;
          log.transcriptUrl = transcriptUrl;
          await log.addEvent('transcript', { url: transcriptUrl });
          
        } catch (err) {
          console.error('Erro ao anexar transcrição:', err);
        }
      }
    } catch (error) {
      console.error('Erro geral em attachTranscript:', error);
    }
  }

  /**
   * Constrói embed do ticket
   */
  buildTicketEmbed(ticket, event, data = {}) {
    const statusEmojis = {
      open: '🟢',
      claimed: '🟡',
      closed: '🔴',
      archived: '📦',
      reopened: '🔵'
    };

    const eventNames = {
      created: 'Ticket Criado',
      claimed: 'Ticket Assumido',
      moved: 'Ticket Movido',
      renamed: 'Ticket Renomeado',
      archived: 'Ticket Arquivado',
      closed: 'Ticket Encerrado',
      reopened: 'Ticket Reaberto',
      transcript: 'Transcrição Gerada'
    };

    const statusColor = {
      open: 0x57F287,    // Verde
      claimed: 0xFEE75C, // Amarelo
      closed: 0xED4245,  // Vermelho
      archived: 0x5865F2,// Azul
      reopened: 0x3BA55D // Verde escuro
    };

    const embed = {
      title: `${statusEmojis[ticket.status] || '🎫'} Ticket #${ticket.id}`,
      color: statusColor[ticket.status] || 0x5865F2,
      fields: [
        {
          name: '📊 Estado',
          value: eventNames[event] || ticket.status.toUpperCase(),
          inline: true
        },
        {
          name: '👤 Criado por',
          value: `<@${ticket.user_id}>`,
          inline: true
        },
        {
          name: '📁 Categoria',
          value: ticket.category || 'Geral',
          inline: true
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: `Servidor: ${ticket.guild_id} • Ticket ID: ${ticket.id}`
      }
    };

    // Adicionar campo de staff se existir
    if (ticket.claimed_by) {
      embed.fields.push({
        name: '👔 Staff Responsável',
        value: `<@${ticket.claimed_by}>`,
        inline: true
      });
    }

    // Adicionar informações específicas do evento
    if (data.reason) {
      embed.fields.push({
        name: '📝 Motivo',
        value: data.reason,
        inline: false
      });
    }

    if (data.newChannel) {
      embed.fields.push({
        name: '📺 Novo Canal',
        value: `<#${data.newChannel}>`,
        inline: true
      });
    }

    if (data.messageCount) {
      embed.fields.push({
        name: '💬 Mensagens',
        value: data.messageCount.toString(),
        inline: true
      });
    }

    return embed;
  }

  /**
   * Envia mensagem via webhook
   */
  async sendWebhook(url, payload, retries = 0) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Se webhook foi deletado (404) ou não autorizado (401), não retry
      if (response.status === 404 || response.status === 401) {
        console.error(`Webhook inválido (${response.status}): Provavelmente foi deletado ou URL está incorreta`);
        return response;
      }

      if (!response.ok && retries < this.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        return this.sendWebhook(url, payload, retries + 1);
      }

      return response;
    } catch (error) {
      console.error('Erro ao enviar webhook:', error);
      if (retries < this.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        return this.sendWebhook(url, payload, retries + 1);
      }
      throw error;
    }
  }

  /**
   * Atualiza mensagem existente via webhook
   */
  async updateWebhookMessage(webhookUrl, messageId, payload) {
    try {
      // Extrair token e ID do webhook da URL
      const match = webhookUrl.match(/\/webhooks\/(\d+)\/([^/]+)/);
      if (!match) throw new Error('URL de webhook inválida');

      const [, webhookId, webhookToken] = match;
      const editUrl = `https://discord.com/api/webhooks/${webhookId}/${webhookToken}/messages/${messageId}`;

      const response = await fetch(editUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Se webhook foi deletado, retornar false sem erro
      if (response.status === 404 || response.status === 401) {
        console.error(`Webhook ou mensagem não encontrada (${response.status}): Pode ter sido deletado`);
        return false;
      }

      return response.ok;
    } catch (error) {
      console.error('Erro ao atualizar mensagem webhook:', error);
      return false;
    }
  }

  /**
   * Testa webhook enviando mensagem de exemplo
   */
  async testWebhook(url) {
    try {
      const payload = {
        embeds: [{
          title: '✅ Teste de Webhook',
          description: 'Este webhook está configurado corretamente!\n\nO sistema de logs está pronto para enviar atualizações.',
          color: 0x57F287,
          timestamp: new Date().toISOString(),
          footer: {
            text: 'IGNIS Bot - Sistema de Webhooks'
          }
        }]
      };

      const response = await this.sendWebhook(url, payload);
      return response.ok;
    } catch (error) {
      console.error('Erro ao testar webhook:', error);
      return false;
    }
  }
}

module.exports = new WebhookManager();
