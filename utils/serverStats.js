const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { WelcomeConfigModel } = require('./db/models');
const logger = require('./logger');

/**
 * 📊 SERVER STATUS COUNTERS
 * 
 * Cria e atualiza canais de voz dinâmicos com estatísticas do servidor:
 * - Total de membros
 * - Humanos (sem bots)
 * - Bots
 * - Boosters
 * - Online agora
 */

// Schema incorporado no WelcomeConfigModel (reutilizar para economizar models)
const DEFAULT_CONFIG = {
  enabled: false,
  category_id: null,
  channels: {
    total_members: null,
    humans: null,
    bots: null,
    boosters: null,
    online: null
  },
  update_interval: 10 // minutos
};

/**
 * Obter configuração de stats de um servidor
 */
async function getStatsConfig(guildId) {
  try {
    const config = await WelcomeConfigModel.findOne({ guild_id: guildId }).lean();
    return config?.server_stats || DEFAULT_CONFIG;
  } catch (error) {
    logger.error('[ServerStats] Error getting config:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Salvar configuração de stats
 */
async function saveStatsConfig(guildId, statsConfig) {
  try {
    await WelcomeConfigModel.findOneAndUpdate(
      { guild_id: guildId },
      { $set: { server_stats: statsConfig } },
      { upsert: true }
    );
    return { ok: true };
  } catch (error) {
    logger.error('[ServerStats] Error saving config:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Criar canais de status
 */
async function setupStatsChannels(guild) {
  try {
    const config = await getStatsConfig(guild.id);
    
    // Criar categoria se não existir
    let category = null;
    if (config.category_id) {
      category = guild.channels.cache.get(config.category_id);
    }
    
    if (!category) {
      category = await guild.channels.create({
        name: '📊 SERVER STATUS',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.Connect], // Não pode conectar
            allow: [PermissionFlagsBits.ViewChannel]
          }
        ]
      });
      config.category_id = category.id;
    }

    // Criar canais
    const channels = {};
    
    channels.total_members = await guild.channels.create({
      name: '👥 Carregando...',
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.Connect] }
      ]
    });

    channels.humans = await guild.channels.create({
      name: '🧑 Carregando...',
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.Connect] }
      ]
    });

    channels.bots = await guild.channels.create({
      name: '🤖 Carregando...',
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.Connect] }
      ]
    });

    channels.boosters = await guild.channels.create({
      name: '💎 Carregando...',
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.Connect] }
      ]
    });

    channels.online = await guild.channels.create({
      name: '🟢 Carregando...',
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.Connect] }
      ]
    });

    // Salvar IDs
    config.channels = {
      total_members: channels.total_members.id,
      humans: channels.humans.id,
      bots: channels.bots.id,
      boosters: channels.boosters.id,
      online: channels.online.id
    };
    config.enabled = true;

    await saveStatsConfig(guild.id, config);
    
    // Atualizar imediatamente
    await updateStatsChannels(guild);

    logger.info(`[ServerStats] Setup complete for guild ${guild.name}`);
    return { ok: true, config };
    
  } catch (error) {
    logger.error('[ServerStats] Error setting up channels:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Atualizar canais de status
 */
async function updateStatsChannels(guild) {
  try {
    const config = await getStatsConfig(guild.id);
    if (!config.enabled) return { ok: false, reason: 'disabled' };

    // Fetch all members (cache pode estar incompleto)
    await guild.members.fetch().catch(() => {});

    const members = guild.members.cache;
    const total = members.size;
    const humans = members.filter(m => !m.user.bot).size;
    const bots = members.filter(m => m.user.bot).size;
    const boosters = guild.premiumSubscriptionCount || 0;
    const online = members.filter(m => 
      m.presence?.status === 'online' || 
      m.presence?.status === 'idle' || 
      m.presence?.status === 'dnd'
    ).size;

    // Atualizar cada canal
    const updates = [
      { id: config.channels.total_members, name: `👥 Total: ${total} Membros` },
      { id: config.channels.humans, name: `🧑 Humanos: ${humans}` },
      { id: config.channels.bots, name: `🤖 Bots: ${bots}` },
      { id: config.channels.boosters, name: `💎 Boosters: ${boosters}` },
      { id: config.channels.online, name: `🟢 Online: ${online}` }
    ];

    for (const update of updates) {
      if (!update.id) continue;
      
      const channel = guild.channels.cache.get(update.id) || 
                     await guild.channels.fetch(update.id).catch(() => null);
      
      if (channel && channel.name !== update.name) {
        await channel.setName(update.name).catch(err => {
          logger.warn(`[ServerStats] Failed to update ${update.id}:`, err.message);
        });
      }
    }

    logger.debug(`[ServerStats] Updated for ${guild.name}: ${total} members, ${online} online`);
    return { ok: true, stats: { total, humans, bots, boosters, online } };

  } catch (error) {
    logger.error('[ServerStats] Error updating channels:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Remover canais de status
 */
async function removeStatsChannels(guild) {
  try {
    const config = await getStatsConfig(guild.id);
    
    // Deletar canais
    for (const channelId of Object.values(config.channels || {})) {
      if (!channelId) continue;
      const channel = guild.channels.cache.get(channelId);
      if (channel) {
        await channel.delete().catch(() => {});
      }
    }

    // Deletar categoria
    if (config.category_id) {
      const category = guild.channels.cache.get(config.category_id);
      if (category) {
        await category.delete().catch(() => {});
      }
    }

    // Limpar config
    await saveStatsConfig(guild.id, DEFAULT_CONFIG);

    logger.info(`[ServerStats] Removed for guild ${guild.name}`);
    return { ok: true };

  } catch (error) {
    logger.error('[ServerStats] Error removing channels:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Worker para atualizar todos os servidores
 */
async function updateAllGuilds(client) {
  try {
    const configs = await WelcomeConfigModel.find({ 
      'server_stats.enabled': true 
    }).lean();

    logger.info(`[ServerStats] Updating ${configs.length} guilds`);

    for (const config of configs) {
      const guild = client.guilds.cache.get(config.guild_id);
      if (guild) {
        await updateStatsChannels(guild);
        // Pequeno delay para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return { ok: true, updated: configs.length };

  } catch (error) {
    logger.error('[ServerStats] Worker error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Iniciar worker automático
 */
function initStatsWorker(client) {
  const INTERVAL = 10 * 60 * 1000; // 10 minutos

  const interval = setInterval(() => {
    updateAllGuilds(client);
  }, INTERVAL);

  // Executar na inicialização (após 30s)
  setTimeout(() => {
    updateAllGuilds(client);
  }, 30000);

  logger.info('[ServerStats] Worker initialized (10min interval)');

  return () => clearInterval(interval);
}

module.exports = {
  getStatsConfig,
  saveStatsConfig,
  setupStatsChannels,
  updateStatsChannels,
  removeStatsChannels,
  updateAllGuilds,
  initStatsWorker
};
