const { TimeTrackingSessionModel } = require('../utils/db/models');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { logger } = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    
    // Time tracking buttons
    if (customId.startsWith('timetrack_')) {
      await handleTimeTrackingButton(interaction);
    }
  },
};

async function handleTimeTrackingButton(interaction) {
  const action = interaction.customId.replace('timetrack_', '');
  const userId = interaction.user.id;
  const guildId = interaction.guild.id;

  try {
    const session = await TimeTrackingSessionModel.findActiveSession(guildId, userId);

    if (!session) {
      return interaction.reply({
        content: '❌ Não tens nenhuma sessão ativa.',
        ephemeral: true
      });
    }

    switch (action) {
      case 'pause':
        await handlePause(interaction, session);
        break;
      case 'resume':
        await handleResume(interaction, session);
        break;
      case 'end':
        await handleEnd(interaction, session);
        break;
      case 'refresh':
        await handleRefresh(interaction, session);
        break;
      default:
        await interaction.reply({
          content: '❌ Ação desconhecida.',
          ephemeral: true
        });
    }
  } catch (error) {
    logger.error('[TimeTracking Button] Error:', error);
    
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: '❌ Erro ao processar ação.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: '❌ Erro ao processar ação.',
        ephemeral: true
      });
    }
  }
}

async function handlePause(interaction, session) {
  if (session.status === 'paused') {
    return interaction.reply({
      content: '⚠️ A sessão já está pausada!',
      ephemeral: true
    });
  }

  await session.pause();

  const embed = createSessionEmbed(session);
  const buttons = createSessionButtons(session);

  await interaction.update({
    content: '⏸️ Sessão pausada!',
    embeds: [embed],
    components: [buttons]
  });

  logger.info(`[TimeTracking] Session paused via button: ${session._id}`);
}

async function handleResume(interaction, session) {
  if (session.status !== 'paused') {
    return interaction.reply({
      content: '⚠️ A sessão não está pausada!',
      ephemeral: true
    });
  }

  await session.resume();

  const embed = createSessionEmbed(session);
  const buttons = createSessionButtons(session);

  await interaction.update({
    content: '▶️ Sessão retomada!',
    embeds: [embed],
    components: [buttons]
  });

  logger.info(`[TimeTracking] Session resumed via button: ${session._id}`);
}

async function handleEnd(interaction, session) {
  await session.end(interaction.user.id);

  const embed = createSessionSummaryEmbed(session);

  await interaction.update({
    content: '✅ Sessão terminada!',
    embeds: [embed],
    components: [] // Remove buttons
  });

  logger.info(`[TimeTracking] Session ended via button: ${session._id}`);
}

async function handleRefresh(interaction, session) {
  const embed = createSessionEmbed(session);
  const buttons = createSessionButtons(session);

  await interaction.update({
    embeds: [embed],
    components: [buttons]
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
