const mongoose = require('mongoose');

const webhookConfigSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  logsEnabled: {
    tickets: { type: Boolean, default: false },
    moderation: { type: Boolean, default: false },
    giveaways: { type: Boolean, default: false },
    automod: { type: Boolean, default: false },
    verification: { type: Boolean, default: false }
  },
  webhooks: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    url: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          // Validar URL de webhook do Discord
          return /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(v);
        },
        message: 'URL de webhook do Discord inválida'
      }
    },
    types: [{
      type: String,
      enum: ['tickets', 'moderation', 'giveaways', 'automod', 'verification']
    }],
    enabled: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastTestedAt: Date,
    lastTestSuccess: Boolean
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexar por guildId para queries rápidas
webhookConfigSchema.index({ guildId: 1 });

// Método helper para obter webhooks por tipo
webhookConfigSchema.methods.getWebhooksByType = function(type) {
  return this.webhooks.filter(w => 
    w.enabled && 
    w.types.includes(type)
  );
};

// Método para validar e testar webhook
webhookConfigSchema.methods.testWebhook = async function(webhookId) {
  const webhook = this.webhooks.id(webhookId);
  if (!webhook) throw new Error('Webhook não encontrado');
  
  try {
    const fetch = require('node-fetch');
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '✅ Teste de Webhook',
          description: 'Este webhook está configurado corretamente!',
          color: 0x00ff00,
          timestamp: new Date().toISOString(),
          footer: { text: 'IGNIS Bot - Sistema de Webhooks' }
        }]
      })
    });
    
    webhook.lastTestedAt = new Date();
    webhook.lastTestSuccess = response.ok;
    await this.save();
    
    return response.ok;
  } catch (error) {
    webhook.lastTestedAt = new Date();
    webhook.lastTestSuccess = false;
    await this.save();
    throw error;
  }
};

module.exports = mongoose.model('WebhookConfig', webhookConfigSchema);
