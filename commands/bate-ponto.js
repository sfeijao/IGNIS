const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { TimeTrackingSessionModel } = require('../utils/db/models');
const { logger } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bate-ponto')
    .setDescription('⏱️ Sistema de controlo de tempo de trabalho/atividade')
    .addSubcommand(subcommand =>
      subcommand
        .setName('iniciar')
        .setDescription('Iniciar nova sessão de tracking'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('pausar')
        .setDescription('Pausar sessão ativa')
        .addStringOption(option =>
          option
            .setName('motivo')
            .setDescription('Motivo da pausa (opcional)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('retomar')
        .setDescription('Retomar sessão pausada'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('terminar')
        .setDescription('Terminar sessão ativa'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Ver status da sessão atual'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('historico')
        .setDescription('Ver histórico de sessões')
        .addIntegerOption(option =>
          option
            .setName('limite')
            .setDescription('Número de sessões a mostrar')
            .setMinValue(1)
            .setMaxValue(25)
            .setRequired(false)))
    .setDMPermission(false),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    try {
      switch (subcommand) {
        case 'iniciar':
          await handleStart(interaction, guildId, userId);
          break;
        case 'pausar':
          await handlePause(interaction, guildId, userId);
          break;
        case 'retomar':
          await handleResume(interaction, guildId, userId);
          break;
        case 'terminar':
          await handleEnd(interaction, guildId, userId);
          break;
        case 'status':
          await handleStatus(interaction, guildId, userId);
          break;
        case 'historico':
          await handleHistory(interaction, guildId, userId);
          break;
      }
    } catch (error) {
      logger.error('[BatePonto] Command error:', error);

      const errorMsg = '❌ Erro ao executar comando. Tenta novamente.';

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: errorMsg, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMsg, ephemeral: true });
      }
    }
  }
};

async function handleStart(interaction, guildId, userId) {
  // Verificar se já tem sessão ativa
  const activeSession = await TimeTrackingSessionModel.findActiveSession(guildId, userId);

  if (activeSession) {
    const duration = activeSession.getCurrentDuration();
    return interaction.reply({
      content: `⚠️ Já tens uma sessão ativa!\n\n⏱️ Tempo decorrido: **${duration.active_formatted}**\nUsa \`/bate-ponto status\` para ver detalhes.`,
      ephemeral: true
    });
  }

  // Criar nova sessão
  const session = new TimeTrackingSessionModel({
    guild_id: guildId,
    user_id: userId,
    created_by: userId,
    control_channel_id: interaction.channel.id
  });

  await session.save();

  // Criar painel de controlo
  const embed = createSessionEmbed(session);
  const buttons = createSessionButtons(session);

  const message = await interaction.reply({
    embeds: [embed],
    components: [buttons],
    ephemeral: true,
    fetchReply: true
  });

  // Guardar message ID
  session.control_message_id = message.id;
  await session.save();

  logger.info(`[BatePonto] Session started: ${session._id} (User: ${userId})`);
}

async function handlePause(interaction, guildId, userId) {
  const session = await TimeTrackingSessionModel.findActiveSession(guildId, userId);

  if (!session) {
    return interaction.reply({
      content: '❌ Não tens nenhuma sessão ativa.',
      ephemeral: true
    });
  }

  if (session.status === 'paused') {
    return interaction.reply({
      content: '⚠️ A sessão já está pausada! Usa `/bate-ponto retomar` para continuar.',
      ephemeral: true
    });
  }

  const reason = interaction.options.getString('motivo');
  await session.pause(reason);

  const embed = createSessionEmbed(session);
  const buttons = createSessionButtons(session);

  await interaction.reply({
    content: '⏸️ Sessão pausada!',
    embeds: [embed],
    components: [buttons],
    ephemeral: true
  });

  logger.info(`[BatePonto] Session paused: ${session._id}`);
}

async function handleResume(interaction, guildId, userId) {
  const session = await TimeTrackingSessionModel.findActiveSession(guildId, userId);

  if (!session) {
    return interaction.reply({
      content: '❌ Não tens nenhuma sessão ativa.',
      ephemeral: true
    });
  }

  if (session.status !== 'paused') {
    return interaction.reply({
      content: '⚠️ A sessão não está pausada!',
      ephemeral: true
    });
  }

  await session.resume();

  const embed = createSessionEmbed(session);
  const buttons = createSessionButtons(session);

  await interaction.reply({
    content: '▶️ Sessão retomada!',
    embeds: [embed],
    components: [buttons],
    ephemeral: true
  });

  logger.info(`[BatePonto] Session resumed: ${session._id}`);
}

async function handleEnd(interaction, guildId, userId) {
  const session = await TimeTrackingSessionModel.findActiveSession(guildId, userId);

  if (!session) {
    return interaction.reply({
      content: '❌ Não tens nenhuma sessão ativa.',
      ephemeral: true
    });
  }

  await session.end(userId);

  const embed = createSessionSummaryEmbed(session);

  await interaction.reply({
    content: '✅ Sessão terminada!',
    embeds: [embed],
    ephemeral: true
  });

  logger.info(`[BatePonto] Session ended: ${session._id} (Duration: ${session.active_time_ms}ms)`);
}

async function handleStatus(interaction, guildId, userId) {
  const session = await TimeTrackingSessionModel.findActiveSession(guildId, userId);

  if (!session) {
    return interaction.reply({
      content: '❌ Não tens nenhuma sessão ativa.\n\nUsa `/bate-ponto iniciar` para começar!',
      ephemeral: true
    });
  }

  const embed = createSessionEmbed(session);
  const buttons = createSessionButtons(session);

  await interaction.reply({
    embeds: [embed],
    components: [buttons],
    ephemeral: true
  });
}

async function handleHistory(interaction, guildId, userId) {
  const limit = interaction.options.getInteger('limite') || 5;

  const sessions = await TimeTrackingSessionModel.findUserSessions(guildId, userId, limit);

  if (sessions.length === 0) {
    return interaction.reply({
      content: '📋 Ainda não tens sessões registadas.\n\nUsa `/bate-ponto iniciar` para começar!',
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('📋 Histórico de Sessões')
    .setDescription(`Últimas ${sessions.length} sessões de ${interaction.user.username}`)
    .setColor(0x3498db)
    .setTimestamp();

  sessions.forEach((session, index) => {
    const duration = session.getCurrentDuration();
    const statusEmoji = session.status === 'active' ? '🟢' : session.status === 'paused' ? '⏸️' : '⏹️';

    let fieldValue = `**Status:** ${statusEmoji} ${session.status}\n`;
    fieldValue += `**Início:** <t:${Math.floor(session.started_at.getTime() / 1000)}:R>\n`;

    if (session.ended_at) {
      fieldValue += `**Fim:** <t:${Math.floor(session.ended_at.getTime() / 1000)}:R>\n`;
    }

    fieldValue += `**Tempo ativo:** ${duration.active_formatted}\n`;

    if (session.pauses.length > 0) {
      fieldValue += `**Pausas:** ${session.pauses.length}x`;
    }

    embed.addFields({
      name: `${index + 1}. Sessão ${session._id.toString().slice(-6)}`,
      value: fieldValue,
      inline: false
    });
  });

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

function createSessionEmbed(session) {
  const duration = session.getCurrentDuration();

  const embed = new EmbedBuilder()
    .setTitle('⏱️ Sessão de Time Tracking')
    .setColor(session.status === 'active' ? 0x2ecc71 : 0xf39c12)
    .setTimestamp();

  embed.addFields(
    {
      name: '📊 Status',
      value: session.status === 'active' ? '🟢 Ativa' : '⏸️ Pausada',
      inline: true
    },
    {
      name: '🕐 Início',
      value: `<t:${Math.floor(session.started_at.getTime() / 1000)}:R>`,
      inline: true
    },
    {
      name: '⏱️ Tempo Ativo',
      value: `**${duration.active_formatted}**`,
      inline: true
    }
  );

  if (duration.paused_ms > 0) {
    embed.addFields({
      name: '⏸️ Tempo em Pausa',
      value: duration.paused_formatted,
      inline: true
    });
  }

  if (session.pauses.length > 0) {
    embed.addFields({
      name: '📝 Pausas',
      value: `${session.pauses.length}x`,
      inline: true
    });
  }

  embed.setFooter({ text: `ID: ${session._id.toString().slice(-8)}` });

  return embed;
}

function createSessionSummaryEmbed(session) {
  session.calculateTotalTime();

  const embed = new EmbedBuilder()
    .setTitle('✅ Sessão Terminada')
    .setColor(0x3498db)
    .setTimestamp();

  embed.addFields(
    {
      name: '🕐 Início',
      value: `<t:${Math.floor(session.started_at.getTime() / 1000)}:F>`,
      inline: false
    },
    {
      name: '🕐 Fim',
      value: `<t:${Math.floor(session.ended_at.getTime() / 1000)}:F>`,
      inline: false
    },
    {
      name: '⏱️ Tempo Total',
      value: session.formatDuration(session.total_time_ms),
      inline: true
    },
    {
      name: '✅ Tempo Ativo',
      value: `**${session.formatDuration(session.active_time_ms)}**`,
      inline: true
    }
  );

  if (session.pauses.length > 0) {
    const totalPauseTime = session.total_time_ms - session.active_time_ms;
    embed.addFields(
      {
        name: '⏸️ Pausas',
        value: `${session.pauses.length}x (${session.formatDuration(totalPauseTime)})`,
        inline: true
      }
    );
  }

  embed.setFooter({ text: `ID: ${session._id.toString()}` });

  return embed;
}

function createSessionButtons(session) {
  const row = new ActionRowBuilder();

  if (session.status === 'active') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('timetrack_pause')
        .setLabel('⏸️ Pausar')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('timetrack_end')
        .setLabel('⏹️ Terminar')
        .setStyle(ButtonStyle.Danger)
    );
  } else if (session.status === 'paused') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('timetrack_resume')
        .setLabel('▶️ Retomar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('timetrack_end')
        .setLabel('⏹️ Terminar')
        .setStyle(ButtonStyle.Danger)
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('timetrack_refresh')
      .setLabel('🔄 Atualizar')
      .setStyle(ButtonStyle.Primary)
  );

  return row;
}
