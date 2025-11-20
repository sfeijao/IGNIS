const { mongoose } = require('../mongoose');

/**
 * ServerStatsConfig Model
 *
 * Configuração para canais de estatísticas dinâmicas do servidor
 * Cria e atualiza canais de voz com nomes dinâmicos (ex: "👥 Members: 123")
 */
const ServerStatsConfigSchema = new mongoose.Schema({
  guild_id: {
    type: String,
    required: true,
    unique: true
  },

  // Status geral do sistema
  enabled: {
    type: Boolean,
    default: true
  },

  // Categoria onde os canais serão criados
  category_id: {
    type: String
  },
  category_name: {
    type: String,
    default: '📊 SERVER STATS'
  },

  // Intervalo de atualização (em minutos)
  update_interval_minutes: {
    type: Number,
    default: 10,
    min: 5,
    max: 60
  },

  // Métricas habilitadas
  metrics: {
    total_members: {
      type: Boolean,
      default: true
    },
    human_members: {
      type: Boolean,
      default: true
    },
    bot_members: {
      type: Boolean,
      default: false
    },
    online_members: {
      type: Boolean,
      default: true
    },
    boosters: {
      type: Boolean,
      default: false
    },
    total_channels: {
      type: Boolean,
      default: false
    },
    total_roles: {
      type: Boolean,
      default: false
    },
    active_tickets: {
      type: Boolean,
      default: false
    }
  },

  // Canais criados (mapping métrica -> channel ID)
  channels: {
    total_members: { type: String },
    human_members: { type: String },
    bot_members: { type: String },
    online_members: { type: String },
    boosters: { type: String },
    total_channels: { type: String },
    total_roles: { type: String },
    active_tickets: { type: String }
  },

  // Customização de nomes/emojis
  custom_names: {
    total_members: {
      type: String,
      default: '👥 Members: {count}'
    },
    human_members: {
      type: String,
      default: '👤 Humans: {count}'
    },
    bot_members: {
      type: String,
      default: '🤖 Bots: {count}'
    },
    online_members: {
      type: String,
      default: '🟢 Online: {count}'
    },
    boosters: {
      type: String,
      default: '💎 Boosters: {count}'
    },
    total_channels: {
      type: String,
      default: '📺 Channels: {count}'
    },
    total_roles: {
      type: String,
      default: '🎭 Roles: {count}'
    },
    active_tickets: {
      type: String,
      default: '🎫 Tickets: {count}'
    }
  },

  // Timestamp da última atualização
  last_update_at: {
    type: Date
  },

  // Metadata
  created_by: {
    type: String
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes para queries eficientes
ServerStatsConfigSchema.index({ enabled: 1 });
ServerStatsConfigSchema.index({ last_update_at: 1 });

// Métodos de instância
ServerStatsConfigSchema.methods.getEnabledMetrics = function() {
  const enabled = [];
  for (const [key, value] of Object.entries(this.metrics)) {
    if (value === true) {
      enabled.push(key);
    }
  }
  return enabled;
};

ServerStatsConfigSchema.methods.getChannelName = function(metric, count) {
  const template = this.custom_names[metric];
  if (!template) return `${metric}: ${count}`;
  return template.replace('{count}', count);
};

ServerStatsConfigSchema.methods.hasChannel = function(metric) {
  return !!this.channels[metric];
};

ServerStatsConfigSchema.methods.setChannel = function(metric, channelId) {
  this.channels[metric] = channelId;
  return this.save();
};

ServerStatsConfigSchema.methods.removeChannel = function(metric) {
  this.channels[metric] = undefined;
  return this.save();
};

// Métodos estáticos
ServerStatsConfigSchema.statics.findByGuild = function(guildId) {
  return this.findOne({ guild_id: guildId });
};

ServerStatsConfigSchema.statics.findDueForUpdate = function(maxMinutesAgo = 10) {
  const cutoff = new Date(Date.now() - maxMinutesAgo * 60 * 1000);
  return this.find({
    enabled: true,
    $or: [
      { last_update_at: { $lt: cutoff } },
      { last_update_at: { $exists: false } }
    ]
  });
};

// Pre-save middleware
ServerStatsConfigSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

const ServerStatsConfigModel = mongoose.models.ServerStatsConfig ||
  mongoose.model('ServerStatsConfig', ServerStatsConfigSchema);

module.exports = { ServerStatsConfigModel };
