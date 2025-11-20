const { mongoose } = require('../mongoose');

/**
 * GuildAssetConfig Model
 *
 * Configuração de assets customizados por servidor (avatar, banner)
 * Usa webhooks do Discord para override de avatar em mensagens
 */
const GuildAssetConfigSchema = new mongoose.Schema({
  guild_id: {
    type: String,
    required: true,
    unique: true
  },

  // Avatar customizado (URL ou base64)
  custom_avatar_url: {
    type: String
  },

  custom_avatar_base64: {
    type: String
  }, // Stored locally if uploaded

  // Banner customizado
  custom_banner_url: {
    type: String
  },

  custom_banner_base64: {
    type: String
  },

  // Webhook configurations para override de avatar
  webhook_configs: [{
    channel_id: {
      type: String,
      required: true
    },
    webhook_id: {
      type: String,
      required: true
    },
    webhook_token: {
      type: String,
      required: true
    },
    use_custom_avatar: {
      type: Boolean,
      default: true
    },
    custom_name: {
      type: String
    }, // Override webhook name
    enabled: {
      type: Boolean,
      default: true
    }
  }],

  // Metadata
  created_by: {
    type: String
  },
  updated_by: {
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
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Métodos estáticos
GuildAssetConfigSchema.statics.findByGuild = function(guildId) {
  return this.findOne({ guild_id: guildId });
};

GuildAssetConfigSchema.statics.findOrCreate = async function(guildId, createdBy = null) {
  let config = await this.findByGuild(guildId);

  if (!config) {
    config = new this({
      guild_id: guildId,
      created_by: createdBy
    });
    await config.save();
  }

  return config;
};

// Métodos de instância
GuildAssetConfigSchema.methods.setCustomAvatar = function(avatarUrl, updatedBy = null) {
  this.custom_avatar_url = avatarUrl;
  this.custom_avatar_base64 = null; // Clear base64 if URL is set
  this.updated_by = updatedBy;
  return this.save();
};

GuildAssetConfigSchema.methods.setCustomAvatarBase64 = function(base64Data, updatedBy = null) {
  this.custom_avatar_base64 = base64Data;
  this.custom_avatar_url = null; // Clear URL if base64 is set
  this.updated_by = updatedBy;
  return this.save();
};

GuildAssetConfigSchema.methods.setCustomBanner = function(bannerUrl, updatedBy = null) {
  this.custom_banner_url = bannerUrl;
  this.custom_banner_base64 = null;
  this.updated_by = updatedBy;
  return this.save();
};

GuildAssetConfigSchema.methods.setCustomBannerBase64 = function(base64Data, updatedBy = null) {
  this.custom_banner_base64 = base64Data;
  this.custom_banner_url = null;
  this.updated_by = updatedBy;
  return this.save();
};

GuildAssetConfigSchema.methods.getAvatarData = function() {
  return this.custom_avatar_url || this.custom_avatar_base64;
};

GuildAssetConfigSchema.methods.getBannerData = function() {
  return this.custom_banner_url || this.custom_banner_base64;
};

GuildAssetConfigSchema.methods.addWebhookConfig = function(channelId, webhookId, webhookToken, customName = null) {
  this.webhook_configs.push({
    channel_id: channelId,
    webhook_id: webhookId,
    webhook_token: webhookToken,
    custom_name: customName,
    use_custom_avatar: true,
    enabled: true
  });
  return this.save();
};

GuildAssetConfigSchema.methods.removeWebhookConfig = function(webhookId) {
  this.webhook_configs = this.webhook_configs.filter(w => w.webhook_id !== webhookId);
  return this.save();
};

GuildAssetConfigSchema.methods.getEnabledWebhooks = function() {
  return this.webhook_configs.filter(w => w.enabled);
};

const GuildAssetConfigModel = mongoose.models.GuildAssetConfig ||
  mongoose.model('GuildAssetConfig', GuildAssetConfigSchema);

module.exports = { GuildAssetConfigModel };
