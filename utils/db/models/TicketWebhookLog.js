const mongoose = require('mongoose');

const ticketWebhookLogSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    index: true
  },
  guildId: {
    type: String,
    required: true,
    index: true
  },
  webhookUrl: {
    type: String,
    required: true
  },
  webhookName: {
    type: String,
    default: 'Webhook'
  },
  messageId: {
    type: String,
    required: true
  },
  threadId: String, // Para Discord threads (opcional)
  status: {
    type: String,
    enum: ['sent', 'updated', 'failed'],
    default: 'sent'
  },
  lastUpdate: {
    type: Date,
    default: Date.now
  },
  updateCount: {
    type: Number,
    default: 0
  },
  events: [{
    type: {
      type: String,
      enum: ['created', 'claimed', 'moved', 'renamed', 'archived', 'closed', 'reopened', 'transcript']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    data: mongoose.Schema.Types.Mixed
  }],
  transcriptAttached: {
    type: Boolean,
    default: false
  },
  transcriptUrl: String,
  error: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices compostos para queries eficientes
ticketWebhookLogSchema.index({ ticketId: 1, guildId: 1 });
ticketWebhookLogSchema.index({ guildId: 1, createdAt: -1 });

// Método para adicionar evento
ticketWebhookLogSchema.methods.addEvent = function(type, data = {}) {
  this.events.push({
    type,
    timestamp: new Date(),
    data
  });
  this.lastUpdate = new Date();
  this.updateCount += 1;
  return this.save();
};

module.exports = mongoose.model('TicketWebhookLog', ticketWebhookLogSchema);
