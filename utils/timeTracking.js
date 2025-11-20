const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { TimeTrackingModel } = require('./db/timeTracking');
const logger = require('./logger');

/**
 * ⏱️ TIME TRACKING / BATE-PONTO
 *
 * Sistema que permite users rastrear tempo de trabalho/estudo.
 * - 1 mensagem por sessão (sempre edita, nunca cria nova)
 * - Start, Pause, Continue, End
 * - Cálculo automático de tempo total e efetivo
 */

/**
 * Formatar duração em ms para string legível
 */
function formatDuration(ms) {
  if (ms < 0) return '0s';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const m = minutes % 60;
    const s = seconds % 60;
    return `${hours}h ${m}m ${s}s`;
  }
  if (minutes > 0) {
    const s = seconds % 60;
    return `${minutes}m ${s}s`;
  }
  return `${seconds}s`;
}

/**
 * Calcular tempo total de pausas
 */
function calculatePauseTime(pauses) {
  return pauses.reduce((total, pause) => {
    if (pause.started && pause.ended) {
      return total + (new Date(pause.ended) - new Date(pause.started));
    }
    return total;
  }, 0);
}

/**
 * Criar embed de bate-ponto
 */
function createTrackingEmbed(session, user) {
  const now = Date.now();
  const startedAt = new Date(session.started_at).getTime();
  const totalElapsed = now - startedAt;

  const pauseTime = calculatePauseTime(session.pauses || []);
  const activeTime = totalElapsed - pauseTime;

  const embed = new EmbedBuilder()
    .setColor(session.status === 'active' ? 0x10B981 : session.status === 'paused' ? 0xF59E0B : 0x6B7280)
    .setTitle('⏱️ BATE-PONTO')
    .setDescription(`**${user.tag}**`)
    .addFields(
      {
        name: '🟢 Início',
        value: `<t:${Math.floor(startedAt / 1000)}:T>`,
        inline: true
      },
      {
        name: '📊 Status',
        value: session.status === 'active' ? '▶️ Ativo' : session.status === 'paused' ? '⏸️ Pausado' : '🏁 Finalizado',
        inline: true
      }
    );

  if (session.pauses && session.pauses.length > 0) {
    const pausesList = session.pauses
      .filter(p => p.started && p.ended)
      .slice(-3) // Últimas 3 pausas
      .map((p, idx) => {
        const start = Math.floor(new Date(p.started).getTime() / 1000);
        const end = Math.floor(new Date(p.ended).getTime() / 1000);
        const duration = formatDuration(new Date(p.ended) - new Date(p.started));
        return `• <t:${start}:t> → <t:${end}:t> (${duration})`;
      })
      .join('\n');

    if (pausesList) {
      embed.addFields({
        name: `⏸️ Pausas (${session.pauses.length})`,
        value: pausesList || 'Nenhuma',
        inline: false
      });
    }
  }

  embed.addFields(
    {
      name: '⏰ Tempo Total',
      value: formatDuration(totalElapsed),
      inline: true
    },
    {
      name: '📊 Tempo Efetivo',
      value: formatDuration(activeTime),
      inline: true
    }
  );

  if (session.ended_at) {
    const endedAt = Math.floor(new Date(session.ended_at).getTime() / 1000);
    embed.addFields({
      name: '🏁 Término',
      value: `<t:${endedAt}:T>`,
      inline: true
    });
  }

  embed.setFooter({ text: `Session ID: ${session._id}` });
  embed.setTimestamp();

  return embed;
}

/**
 * Criar botões de controle
 */
function createTrackingButtons(status) {
  const row = new ActionRowBuilder();

  if (status === 'active') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('timetrack:pause')
        .setLabel('⏸️ Pausar')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('timetrack:end')
        .setLabel('🏁 Finalizar')
        .setStyle(ButtonStyle.Danger)
    );
  } else if (status === 'paused') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('timetrack:continue')
        .setLabel('▶️ Continuar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('timetrack:end')
        .setLabel('🏁 Finalizar')
        .setStyle(ButtonStyle.Danger)
    );
  } else {
    // Ended - sem botões
    return null;
  }

  return row;
}

/**
 * Iniciar sessão de tracking
 */
async function startTracking(interaction) {
  try {
    // Verificar se já tem sessão ativa
    const existing = await TimeTrackingModel.findOne({
      guild_id: interaction.guild.id,
      user_id: interaction.user.id,
      status: { $in: ['active', 'paused'] }
    });

    if (existing) {
      const replyMethod = interaction.deferred || interaction.replied ? 'followUp' : 'reply';
      return interaction[replyMethod]({
        content: `⚠️ Você já tem uma sessão ativa! Use os botões na mensagem <#${existing.channel_id}> ou finalize primeiro.`,
        ephemeral: true
      });
    }

    // Criar nova sessão
    const session = await TimeTrackingModel.create({
      guild_id: interaction.guild.id,
      user_id: interaction.user.id,
      started_at: new Date(),
      status: 'active',
      pauses: []
    });

    // Enviar mensagem
    const embed = createTrackingEmbed(session, interaction.user);
    const buttons = createTrackingButtons('active');

    // Se a interação foi deferida ou já respondida, usar followUp; caso contrário, reply
    let message;
    if (interaction.deferred || interaction.replied) {
      message = await interaction.followUp({
        embeds: [embed],
        components: buttons ? [buttons] : [],
        fetchReply: true
      });
    } else {
      message = await interaction.reply({
        embeds: [embed],
        components: buttons ? [buttons] : [],
        fetchReply: true
      });
    }

    // Atualizar sessão com message_id
    await TimeTrackingModel.updateOne(
      { _id: session._id },
      {
        message_id: message.id,
        channel_id: interaction.channel.id
      }
    );

    logger.info(`[TimeTracking] Started session ${session._id} for ${interaction.user.tag}`);

  } catch (error) {
    logger.error('[TimeTracking] Start error:', error);
    const replyMethod = interaction.deferred || interaction.replied ? 'followUp' : 'reply';
    return interaction[replyMethod]({
      content: '❌ Erro ao iniciar sessão de tracking.',
      ephemeral: true
    });
  }
}

/**
 * Pausar sessão
 */
async function pauseTracking(interaction) {
  try {
    const session = await TimeTrackingModel.findOne({
      guild_id: interaction.guild.id,
      user_id: interaction.user.id,
      message_id: interaction.message.id,
      status: 'active'
    });

    if (!session) {
      const replyMethod = interaction.deferred || interaction.replied ? 'followUp' : 'reply';
      return interaction[replyMethod]({
        content: '❌ Sessão não encontrada ou já pausada.',
        ephemeral: true
      });
    }

    // Adicionar pausa
    session.pauses.push({ started: new Date(), ended: null });
    session.status = 'paused';
    await session.save();

    // Atualizar mensagem
    const embed = createTrackingEmbed(session, interaction.user);
    const buttons = createTrackingButtons('paused');

    await interaction.update({
      embeds: [embed],
      components: buttons ? [buttons] : []
    });

    logger.info(`[TimeTracking] Paused session ${session._id}`);

  } catch (error) {
    logger.error('[TimeTracking] Pause error:', error);
    const replyMethod = interaction.deferred || interaction.replied ? 'followUp' : 'reply';
    return interaction[replyMethod]({
      content: '❌ Erro ao pausar.',
      ephemeral: true
    });
  }
}

/**
 * Continuar sessão
 */
async function continueTracking(interaction) {
  try {
    const session = await TimeTrackingModel.findOne({
      guild_id: interaction.guild.id,
      user_id: interaction.user.id,
      message_id: interaction.message.id,
      status: 'paused'
    });

    if (!session) {
      const replyMethod = interaction.deferred || interaction.replied ? 'followUp' : 'reply';
      return interaction[replyMethod]({
        content: '❌ Sessão não encontrada ou não está pausada.',
        ephemeral: true
      });
    }

    // Finalizar última pausa
    if (session.pauses.length > 0) {
      const lastPause = session.pauses[session.pauses.length - 1];
      if (!lastPause.ended) {
        lastPause.ended = new Date();
      }
    }

    session.status = 'active';
    await session.save();

    // Atualizar mensagem
    const embed = createTrackingEmbed(session, interaction.user);
    const buttons = createTrackingButtons('active');

    await interaction.update({
      embeds: [embed],
      components: buttons ? [buttons] : []
    });

    logger.info(`[TimeTracking] Continued session ${session._id}`);

  } catch (error) {
    logger.error('[TimeTracking] Continue error:', error);
    const replyMethod = interaction.deferred || interaction.replied ? 'followUp' : 'reply';
    return interaction[replyMethod]({
      content: '❌ Erro ao continuar.',
      ephemeral: true
    });
  }
}

/**
 * Finalizar sessão
 */
async function endTracking(interaction) {
  try {
    const session = await TimeTrackingModel.findOne({
      guild_id: interaction.guild.id,
      user_id: interaction.user.id,
      message_id: interaction.message.id,
      status: { $in: ['active', 'paused'] }
    });

    if (!session) {
      const replyMethod = interaction.deferred || interaction.replied ? 'followUp' : 'reply';
      return interaction[replyMethod]({
        content: '❌ Sessão não encontrada.',
        ephemeral: true
      });
    }

    // Finalizar última pausa se estiver pausado
    if (session.status === 'paused' && session.pauses.length > 0) {
      const lastPause = session.pauses[session.pauses.length - 1];
      if (!lastPause.ended) {
        lastPause.ended = new Date();
      }
    }

    session.status = 'ended';
    session.ended_at = new Date();

    // Calcular tempo total
    const totalElapsed = new Date(session.ended_at) - new Date(session.started_at);
    const pauseTime = calculatePauseTime(session.pauses);
    session.total_time = totalElapsed - pauseTime;

    await session.save();

    // Atualizar mensagem
    const embed = createTrackingEmbed(session, interaction.user);

    await interaction.update({
      embeds: [embed],
      components: [] // Remover botões
    });

    logger.info(`[TimeTracking] Ended session ${session._id} - Total: ${formatDuration(session.total_time)}`);

  } catch (error) {
    logger.error('[TimeTracking] End error:', error);
    const replyMethod = interaction.deferred || interaction.replied ? 'followUp' : 'reply';
    return interaction[replyMethod]({
      content: '❌ Erro ao finalizar.',
      ephemeral: true
    });
  }
}

module.exports = {
  startTracking,
  pauseTracking,
  continueTracking,
  endTracking,
  formatDuration,
  createTrackingEmbed,
  createTrackingButtons,
  TimeTrackingModel
};
