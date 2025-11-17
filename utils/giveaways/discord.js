const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const { GiveawayModel, GiveawayWinnerModel } = require('../db/giveawayModels');
const { getClient } = require('../discordClient');

async function publishGiveaway(giveaway){
  const client = getClient();
  if (!client) return { ok:false, error: 'discord_client_unavailable' };
  if (!giveaway.channel_id) return { ok:false, error: 'missing_channel' };
  try {
    const channel = await client.channels.fetch(giveaway.channel_id).catch(()=>null);
    if (!channel || !channel.send) return { ok:false, error:'invalid_channel' };
    // Permissions basic check
    const me = channel.guild?.members?.me || (await channel.guild.members.fetch(client.user.id).catch(()=>null));
    if (!me) return { ok:false, error:'cannot_fetch_bot_member' };
    const perms = channel.permissionsFor(me);
    if (!perms?.has(PermissionsBitField.Flags.SendMessages)) return { ok:false, error:'missing_perm_send' };
    if (giveaway.method === 'reaction' && !perms?.has(PermissionsBitField.Flags.AddReactions)) {
      return { ok:false, error:'missing_perm_add_reactions' };
    }

    // Calcular tempo até o fim
    const endsAt = new Date(giveaway.ends_at);
    const timestamp = Math.floor(endsAt.getTime() / 1000);

    // Criar embed profissional
    const embed = new EmbedBuilder()
      .setTitle(`${giveaway.icon_emoji || '🎉'} Giveaway Started ${giveaway.icon_emoji || '🎉'}`)
      .setColor(0xFF6B6B) // Cor vermelha/laranja como na imagem
      .setTimestamp();

    // Adicionar descrição/título do prémio
    if (giveaway.title) {
      embed.addFields({
        name: '',
        value: `**${giveaway.title}**`,
        inline: false
      });
    }

    // Adicionar campos formatados
    embed.addFields(
      {
        name: `${giveaway.icon_emoji || '🎁'} React with ${giveaway.icon_emoji || '🎉'} to enter!`,
        value: giveaway.description || 'Boa sorte a todos os participantes!',
        inline: false
      },
      {
        name: '⏰ Ending in a day',
        value: `<t:${timestamp}:R>`,
        inline: true
      },
      {
        name: '🎫 Hosted by',
        value: `<@${giveaway.created_by}>`,
        inline: true
      }
    );

    // Adicionar footer
    embed.setFooter({
      text: `${giveaway.winners_count} winner(s) • Tomorrow at ${endsAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`
    });

    // Adicionar banner se existir
    if (giveaway.banner_url) {
      embed.setImage(giveaway.banner_url);
    }

    let components = [];
    if (giveaway.method === 'button'){
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`gw-enter:${giveaway._id}`)
          .setLabel('0')
          .setStyle(ButtonStyle.Success)
          .setEmoji(giveaway.icon_emoji || '🎉')
      );
      components = [row];
    }

    const msg = await channel.send({ embeds: [embed], components });
    if (giveaway.method === 'reaction'){
      try { await msg.react(giveaway.icon_emoji || '🎉'); } catch {}
    }
    await GiveawayModel.updateOne({ _id: giveaway._id }, { $set: { message_id: msg.id, channel_id: msg.channelId } });
    return { ok:true, messageId: msg.id };
  } catch (e) {
    return { ok:false, error: e && e.message || String(e) };
  }
}

async function announceWinners(giveaway, winners){
  const client = getClient();
  if (!client) return { ok:false, error:'discord_client_unavailable' };
  if (!giveaway.channel_id || !giveaway.message_id) return { ok:false, error:'missing_message' };
  try {
    const channel = await client.channels.fetch(giveaway.channel_id).catch(()=>null);
    if (!channel) return { ok:false, error:'channel_not_found' };
    const msg = await channel.messages.fetch(giveaway.message_id).catch(()=>null);
    if (!msg) return { ok:false, error:'message_not_found' };

    // Criar embed de anúncio de vencedores
    const winnerEmbed = new EmbedBuilder()
      .setTitle(`${giveaway.icon_emoji || '🎉'} Giveaway Ended! ${giveaway.icon_emoji || '🎉'}`)
      .setColor(0x57F287) // Verde Discord
      .setTimestamp();

    if (winners && winners.length > 0) {
      const mentions = winners.map(w => `<@${w.user_id}>`).join('\n');
      winnerEmbed.setDescription(
        `**${giveaway.title}**\n\n` +
        `🏆 **Vencedore${winners.length > 1 ? 's' : ''}:**\n${mentions}\n\n` +
        `Parabéns! 🎊`
      );
    } else {
      winnerEmbed.setDescription(
        `**${giveaway.title}**\n\n` +
        `😔 Nenhum participante válido.\n` +
        `O giveaway terminou sem vencedores.`
      );
    }

    winnerEmbed.setFooter({
      text: `${winners?.length || 0} vencedor(es) • Hosted by ${channel.guild.name}`,
      iconURL: channel.guild.iconURL()
    });

    // Anunciar vencedores
    await channel.send({
      content: winners && winners.length ? winners.map(w=>`<@${w.user_id}>`).join(' ') : null,
      embeds: [winnerEmbed]
    });

    // Atualizar mensagem original para mostrar que terminou
    try {
      const oldEmbed = msg.embeds[0];
      if (oldEmbed) {
        const endedEmbed = EmbedBuilder.from(oldEmbed)
          .setColor(0x95A5A6) // Cinza para indicar terminado
          .setTitle(`${giveaway.icon_emoji || '🎉'} Giveaway Ended ${giveaway.icon_emoji || '🎉'}`);

        await msg.edit({ embeds: [endedEmbed], components: [] });
      }
    } catch {}

    return { ok:true };
  } catch (e) {
    return { ok:false, error: e && e.message || String(e) };
  }
}

module.exports = { publishGiveaway, announceWinners };
