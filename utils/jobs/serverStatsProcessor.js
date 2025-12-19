const logger = require('../logger');
const { ServerStatsConfigModel } = require('../db/models');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

/**
 * ServerStatsProcessor
 *
 * Job que atualiza canais de estatísticas dinâmicas do servidor
 * Executa periodicamente para manter os nomes dos canais atualizados
 */
class ServerStatsProcessor {
  constructor(client) {
    this.client = client;
    this.intervalMs = 5 * 60 * 1000; // 5 minutos
    this.intervalId = null;
    this.isRunning = false;
    this.stats = {
      totalRuns: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      channelsUpdated: 0,
      lastRunAt: null,
      lastError: null
    };
  }

  /**
   * Inicia o job processor
   */
  start() {
    if (this.intervalId) {
      logger.warn('[ServerStatsProcessor] Job already running');
      return;
    }

    logger.info('[ServerStatsProcessor] Starting server stats update job...');

    // Executa imediatamente na inicialização
    this.run().catch(err => {
      logger.error('[ServerStatsProcessor] Initial run failed:', err);
    });

    // Agenda execuções periódicas
    this.intervalId = setInterval(() => {
      this.run().catch(err => {
        logger.error('[ServerStatsProcessor] Scheduled run failed:', err);
      });
    }, this.intervalMs);

    logger.info(`[ServerStatsProcessor] Job started (interval: ${this.intervalMs / 1000}s)`);
  }

  /**
   * Para o job processor gracefully
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[ServerStatsProcessor] Job stopped');
    }
  }

  /**
   * Execução principal do job
   */
  async run() {
    if (this.isRunning) {
      logger.debug('[ServerStatsProcessor] Skipping run - job already running');
      return;
    }

    this.isRunning = true;
    this.stats.totalRuns++;
    this.stats.lastRunAt = new Date();

    try {
      logger.info('[ServerStatsProcessor] Starting stats update cycle...');

      // Buscar todas as configurações habilitadas
      const configs = await ServerStatsConfigModel.find({ enabled: true });

      if (configs.length === 0) {
        logger.debug('[ServerStatsProcessor] No enabled configurations found - Configure via dashboard at /guild/{guildId}/stats');
        return;
      }

      logger.info(`[ServerStatsProcessor] Found ${configs.length} enabled guild(s)`);

      // Processar cada guild
      for (const config of configs) {
        try {
          await this.updateGuildStats(config);
          this.stats.successfulUpdates++;
        } catch (err) {
          logger.error(`[ServerStatsProcessor] Failed to update guild ${config.guild_id}:`, err);
          this.stats.failedUpdates++;
          this.stats.lastError = err.message;
        }
      }

      logger.info('[ServerStatsProcessor] Stats update cycle complete', {
        totalConfigs: configs.length,
        successful: this.stats.successfulUpdates,
        failed: this.stats.failedUpdates,
        channelsUpdated: this.stats.channelsUpdated
      });

    } catch (err) {
      logger.error('[ServerStatsProcessor] Job execution failed:', err);
      this.stats.lastError = err.message;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Atualiza estatísticas para uma guild específica
   */
  async updateGuildStats(config) {
    const guild = this.client.guilds.cache.get(config.guild_id);

    if (!guild) {
      logger.warn(`[ServerStatsProcessor] Guild ${config.guild_id} not found in cache`);
      return;
    }

    // Verificar se precisa atualizar baseado no intervalo configurado
    if (config.last_update_at) {
      const minutesSinceUpdate = (Date.now() - config.last_update_at.getTime()) / (60 * 1000);
      if (minutesSinceUpdate < config.update_interval_minutes) {
        logger.debug(`[ServerStatsProcessor] Skipping ${guild.name} - updated ${Math.round(minutesSinceUpdate)}m ago`);
        return;
      }
    }

    logger.info(`[ServerStatsProcessor] Updating stats for: ${guild.name} (${guild.id})`);

    // Fetch membros para estatísticas precisas
    try {
      await guild.members.fetch();
    } catch (err) {
      logger.warn(`[ServerStatsProcessor] Failed to fetch members for ${guild.name}:`, err.message);
    }

    // Calcular métricas
    const metrics = await this.calculateMetrics(guild, config);

    // Atualizar cada canal habilitado
    const enabledMetrics = config.getEnabledMetrics();

    for (const metric of enabledMetrics) {
      const channelId = config.channels[metric];

      if (!channelId) {
        logger.debug(`[ServerStatsProcessor] No channel ID for metric: ${metric}`);
        continue;
      }

      try {
        await this.updateChannel(guild, config, metric, metrics[metric]);
        this.stats.channelsUpdated++;
      } catch (err) {
        logger.error(`[ServerStatsProcessor] Failed to update channel ${channelId}:`, err.message);
      }
    }

    // Atualizar timestamp
    config.last_update_at = new Date();
    await config.save();
  }

  /**
   * Calcula todas as métricas para uma guild
   */
  async calculateMetrics(guild, config) {
    const metrics = {};

    // Total de membros
    metrics.total_members = guild.memberCount;

    // Membros humanos vs bots
    const members = guild.members.cache;
    metrics.human_members = members.filter(m => !m.user.bot).size;
    metrics.bot_members = members.filter(m => m.user.bot).size;

    // Membros online (aproximado - baseado no cache)
    metrics.online_members = members.filter(m =>
      m.presence?.status === 'online' ||
      m.presence?.status === 'idle' ||
      m.presence?.status === 'dnd'
    ).size;

    // Boosters
    metrics.boosters = guild.members.cache.filter(m => m.premiumSince).size;

    // Canais
    metrics.total_channels = guild.channels.cache.size;

    // Roles
    metrics.total_roles = guild.roles.cache.size;

    // Tickets ativos (se módulo de tickets estiver disponível)
    if (global.ticketStorage) {
      try {
        const tickets = await global.ticketStorage.getGuildTickets(guild.id);
        metrics.active_tickets = tickets.filter(t =>
          t.status === 'open' || t.status === 'claimed'
        ).length;
      } catch (err) {
        logger.warn(`[ServerStatsProcessor] Failed to fetch tickets for ${guild.name}:`, err.message);
        metrics.active_tickets = 0;
      }
    } else {
      metrics.active_tickets = 0;
    }

    return metrics;
  }

  /**
   * Atualiza um canal específico com a métrica
   */
  async updateChannel(guild, config, metric, value) {
    const channelId = config.channels[metric];
    const channel = guild.channels.cache.get(channelId);

    if (!channel) {
      logger.warn(`[ServerStatsProcessor] Channel ${channelId} not found for metric ${metric}`);
      return;
    }

    // Gerar nome do canal
    const newName = config.getChannelName(metric, value);

    // Verificar se já está com o nome correto (evitar API calls desnecessárias)
    if (channel.name === newName) {
      logger.debug(`[ServerStatsProcessor] Channel ${channel.name} already up to date`);
      return;
    }

    // Rate limit protection: Discord permite 2 edições por 10 minutos
    const lastEdit = channel.editedTimestamp || 0;
    const timeSinceEdit = Date.now() - lastEdit;
    const tenMinutes = 10 * 60 * 1000;

    if (timeSinceEdit < tenMinutes / 2) {
      logger.warn(`[ServerStatsProcessor] Skipping ${channel.name} - edited too recently (${Math.round(timeSinceEdit / 1000)}s ago)`);
      return;
    }

    // Atualizar nome do canal
    try {
      await channel.setName(newName, `Server stats update: ${metric} = ${value}`);
      logger.info(`[ServerStatsProcessor] Updated channel: ${newName}`);
    } catch (err) {
      if (err.code === 50013) {
        logger.error(`[ServerStatsProcessor] Missing permissions to edit channel ${channel.name}`);
      } else if (err.code === 50001) {
        logger.error(`[ServerStatsProcessor] No access to channel ${channel.name}`);
      } else {
        throw err;
      }
    }
  }

  /**
   * Cria canais de estatísticas para uma guild
   */
  async setupChannels(guildId, userId, selectedMetrics, categoryId = null) {
    const guild = this.client.guilds.cache.get(guildId);

    if (!guild) {
      throw new Error('Guild not found');
    }

    // Verificar permissões do bot
    const botMember = guild.members.cache.get(this.client.user.id);
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      throw new Error('Bot missing MANAGE_CHANNELS permission');
    }

    logger.info(`[ServerStatsProcessor] Setting up stats channels for ${guild.name}`);

    // Buscar ou criar configuração
    let config = await ServerStatsConfigModel.findByGuild(guildId);
    if (!config) {
      config = new ServerStatsConfigModel({
        guild_id: guildId,
        created_by: userId
      });
    }

    // Criar categoria se não especificada
    if (!categoryId) {
      const category = await guild.channels.create({
        name: config.category_name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.Connect] // Apenas visualização
          }
        ]
      });
      categoryId = category.id;
      config.category_id = categoryId;
      logger.info(`[ServerStatsProcessor] Created category: ${category.name}`);
    }

    // Calcular métricas iniciais
    const metrics = await this.calculateMetrics(guild, config);

    // Criar canais para cada métrica selecionada
    const createdChannels = [];

    for (const metric of selectedMetrics) {
      // Ativar métrica
      config.metrics[metric] = true;

      // Verificar se já existe canal
      if (config.channels[metric]) {
        const existingChannel = guild.channels.cache.get(config.channels[metric]);
        if (existingChannel) {
          logger.info(`[ServerStatsProcessor] Channel already exists for ${metric}: ${existingChannel.name}`);
          createdChannels.push({
            metric,
            channelId: existingChannel.id,
            channelName: existingChannel.name,
            existed: true
          });
          continue;
        }
      }

      // Criar novo canal de voz
      const channelName = config.getChannelName(metric, metrics[metric]);

      try {
        const channel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildVoice,
          parent: categoryId,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.Connect], // Não pode conectar
              allow: [PermissionFlagsBits.ViewChannel] // Apenas ver
            }
          ]
        });

        config.channels[metric] = channel.id;

        createdChannels.push({
          metric,
          channelId: channel.id,
          channelName: channel.name,
          existed: false
        });

        logger.info(`[ServerStatsProcessor] Created channel: ${channel.name}`);
      } catch (err) {
        logger.error(`[ServerStatsProcessor] Failed to create channel for ${metric}:`, err);
      }
    }

    // Salvar configuração
    await config.save();

    return {
      success: true,
      categoryId,
      channels: createdChannels,
      config
    };
  }

  /**
   * Desativa estatísticas para uma guild
   */
  async disableStats(guildId, deleteChannels = false) {
    const config = await ServerStatsConfigModel.findByGuild(guildId);

    if (!config) {
      throw new Error('Stats not configured for this guild');
    }

    const guild = this.client.guilds.cache.get(guildId);

    // Deletar canais se solicitado
    if (deleteChannels && guild) {
      const channelIds = Object.values(config.channels).filter(id => id);

      for (const channelId of channelIds) {
        try {
          const channel = guild.channels.cache.get(channelId);
          if (channel) {
            await channel.delete('Server stats disabled');
            logger.info(`[ServerStatsProcessor] Deleted channel: ${channel.name}`);
          }
        } catch (err) {
          logger.error(`[ServerStatsProcessor] Failed to delete channel ${channelId}:`, err);
        }
      }

      // Deletar categoria se existir
      if (config.category_id) {
        try {
          const category = guild.channels.cache.get(config.category_id);
          if (category) {
            await category.delete('Server stats disabled');
            logger.info(`[ServerStatsProcessor] Deleted category: ${category.name}`);
          }
        } catch (err) {
          logger.error(`[ServerStatsProcessor] Failed to delete category:`, err);
        }
      }
    }

    // Desativar configuração
    config.enabled = false;
    await config.save();

    logger.info(`[ServerStatsProcessor] Disabled stats for guild ${guildId}`);

    return { success: true, deletedChannels: deleteChannels };
  }

  /**
   * Retorna estatísticas do job
   */
  getStats() {
    return { ...this.stats };
  }
}

module.exports = { ServerStatsProcessor };
