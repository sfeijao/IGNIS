const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { startTracking, TimeTrackingModel, formatDuration } = require('../utils/timeTracking');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bate-ponto')
    .setDescription('⏱️ Sistema de rastreamento de tempo de trabalho/estudo')
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Iniciar nova sessão de tracking')
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Ver sua sessão ativa atual')
    )
    .addSubcommand(sub =>
      sub
        .setName('historico')
        .setDescription('Ver histórico de sessões finalizadas')
        .addIntegerOption(opt =>
          opt
            .setName('limit')
            .setDescription('Quantas sessões mostrar (padrão: 5)')
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .setDMPermission(false),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'start') {
      return startTracking(interaction);
    }

    if (subcommand === 'status') {
      try {
        const session = await TimeTrackingModel.findOne({
          guild_id: interaction.guild.id,
          user_id: interaction.user.id,
          status: { $in: ['active', 'paused'] }
        });

        if (!session) {
          return interaction.reply({
            content: '⚠️ Você não tem nenhuma sessão ativa.\n💡 Use `/bate-ponto start` para iniciar.',
            ephemeral: true
          });
        }

        const now = Date.now();
        const startedAt = new Date(session.started_at).getTime();
        const totalElapsed = now - startedAt;
        
        const pauseTime = session.pauses.reduce((total, pause) => {
          if (pause.started && pause.ended) {
            return total + (new Date(pause.ended) - new Date(pause.started));
          }
          return total;
        }, 0);

        const activeTime = totalElapsed - pauseTime;

        return interaction.reply({
          content: [
            '📊 **SESSÃO ATIVA**',
            `📍 Canal: <#${session.channel_id}>`,
            `🟢 Início: <t:${Math.floor(startedAt / 1000)}:R>`,
            `📊 Status: ${session.status === 'active' ? '▶️ Ativo' : '⏸️ Pausado'}`,
            `⏰ Tempo Total: **${formatDuration(totalElapsed)}**`,
            `📊 Tempo Efetivo: **${formatDuration(activeTime)}**`,
            session.pauses.length > 0 ? `⏸️ Pausas: ${session.pauses.length}` : '',
            '',
            `💡 Volte para a mensagem original para controlar a sessão.`
          ].filter(Boolean).join('\n'),
          ephemeral: true
        });

      } catch (error) {
        console.error('[BatePonto] Status error:', error);
        return interaction.reply({
          content: '❌ Erro ao buscar sessão.',
          ephemeral: true
        });
      }
    }

    if (subcommand === 'historico') {
      try {
        const limit = interaction.options.getInteger('limit') || 5;

        const sessions = await TimeTrackingModel.find({
          guild_id: interaction.guild.id,
          user_id: interaction.user.id,
          status: 'ended'
        })
          .sort({ ended_at: -1 })
          .limit(limit);

        if (sessions.length === 0) {
          return interaction.reply({
            content: '📂 Você ainda não tem sessões finalizadas.\n💡 Use `/bate-ponto start` para começar.',
            ephemeral: true
          });
        }

        const historyText = sessions.map((s, idx) => {
          const date = new Date(s.ended_at);
          const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
          return [
            `**${idx + 1}. ${dateStr}**`,
            `• Início: <t:${Math.floor(new Date(s.started_at).getTime() / 1000)}:t>`,
            `• Fim: <t:${Math.floor(new Date(s.ended_at).getTime() / 1000)}:t>`,
            `• Tempo Efetivo: **${formatDuration(s.total_time)}**`,
            `• Pausas: ${s.pauses.length}`,
            ''
          ].join('\n');
        }).join('\n');

        const totalTime = sessions.reduce((sum, s) => sum + (s.total_time || 0), 0);

        return interaction.reply({
          content: [
            `📂 **HISTÓRICO DE SESSÕES** (últimas ${sessions.length})`,
            '',
            historyText,
            '─'.repeat(40),
            `⏱️ **TOTAL GERAL:** ${formatDuration(totalTime)}`
          ].join('\n'),
          ephemeral: true
        });

      } catch (error) {
        console.error('[BatePonto] History error:', error);
        return interaction.reply({
          content: '❌ Erro ao buscar histórico.',
          ephemeral: true
        });
      }
    }
  }
};
