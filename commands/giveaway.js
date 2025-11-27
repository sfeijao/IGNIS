const logger = require('../utils/logger');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { GiveawayModel } = require('../utils/db/giveawayModels');
const { publishGiveaway } = require('../utils/giveaways/discord');
const { endGiveaway, rerollGiveaway } = require('../utils/giveaways/service');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Gerir giveaways')
    .addSubcommand(sub => sub
      .setName('start')
      .setDescription('Inicia um novo giveaway')
      .addStringOption(o=>o.setName('titulo').setDescription('Título / Prémio').setRequired(true))
      .addIntegerOption(o=>o.setName('vencedores').setDescription('Número de vencedores').setRequired(true))
      .addIntegerOption(o=>o.setName('duracao').setDescription('Duração em minutos').setRequired(true))
      .addChannelOption(o=>o.setName('canal').setDescription('Canal destino').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('end')
      .setDescription('Termina um giveaway imediatamente')
      .addStringOption(o=>o.setName('id').setDescription('ID do giveaway').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('reroll')
      .setDescription('Reroll de um giveaway terminado')
      .addStringOption(o=>o.setName('id').setDescription('ID do giveaway').setRequired(true))
      .addIntegerOption(o=>o.setName('vencedores').setDescription('Quantidade (default original)'))
    )
    .addSubcommand(sub => sub
      .setName('cancel')
      .setDescription('Cancela um giveaway ativo')
      .addStringOption(o=>o.setName('id').setDescription('ID do giveaway').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction){
    const sub = interaction.options.getSubcommand();
    try {
      if (sub === 'start') {
        const title = interaction.options.getString('titulo', true);
        const winners = interaction.options.getInteger('vencedores', true);
        const dur = interaction.options.getInteger('duracao', true);
        const channel = interaction.options.getChannel('canal', true);
        const ends = new Date(Date.now() + dur*60*1000);
        const doc = await GiveawayModel.create({
          guild_id: interaction.guildId,
            channel_id: channel.id,
            title,
            winners_count: winners,
            description: '',
            status: 'active',
            starts_at: new Date(),
            ends_at: ends,
            method: 'button'
        });
        const pub = await publishGiveaway(doc.toObject());
        if (!pub.ok) return interaction.reply({ content: `Falha ao publicar: ${pub.error}`, flags: 64 });
        await interaction.reply({ content: `Giveaway iniciado (#${doc._id}) termina <t:${Math.floor(ends.getTime()/1000)}:R>`, flags: 64 });
      } else if (sub === 'end') {
        const id = interaction.options.getString('id', true);
        const res = await endGiveaway(id, interaction.guildId, { actorId: interaction.user.id });
        if (!res.ok) return interaction.reply({ content: `Não foi possível terminar: ${res.reason || res.error}`, flags: 64 });
        await interaction.reply({ content: `Giveaway terminado. Vencedores: ${res.winners.map(w=>`<@${w.user_id}>`).join(', ') || 'Nenhum'}`, flags: 64 });
      } else if (sub === 'reroll') {
        const id = interaction.options.getString('id', true);
        const count = interaction.options.getInteger('vencedores') || undefined;
        const res = await rerollGiveaway(id, interaction.guildId, count, { actorId: interaction.user.id });
        if (!res.ok) return interaction.reply({ content: `Não foi possível reroll: ${res.reason || res.error}`, flags: 64 });
        await interaction.reply({ content: `Novo(s) vencedor(es): ${res.winners.map(w=>`<@${w.user_id}>`).join(', ') || 'Nenhum'}`, flags: 64 });
      } else if (sub === 'cancel') {
        const id = interaction.options.getString('id', true);
        const g = await GiveawayModel.findOne({ _id: id, guild_id: interaction.guildId });
        if (!g) return interaction.reply({ content: 'Giveaway não encontrado', flags: 64 });
        if (g.status !== 'active' && g.status !== 'scheduled') return interaction.reply({ content: 'Estado não permite cancelamento', flags: 64 });
        g.status = 'cancelled';
        g.ended_at = new Date();
        await g.save();
        await interaction.reply({ content: 'Giveaway cancelado', flags: 64 });
      }
    } catch (e) {
      try { await interaction.reply({ content: `Erro: ${e && e.message || e}`, flags: 64 }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
    }
  }
};
