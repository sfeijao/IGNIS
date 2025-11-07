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
    const me = channel.guild?.members?.me || (await channel.guild.members.fetch(client.user.id));
    const perms = channel.permissionsFor(me);
    if (!perms?.has(PermissionsBitField.Flags.SendMessages)) return { ok:false, error:'missing_perm_send' };

    const embed = new EmbedBuilder()
      .setTitle(`${giveaway.icon_emoji || '🎉'} ${giveaway.title}`)
      .setDescription(giveaway.description || '')
      .setColor(0x8b5cf6);
    if (giveaway.banner_url) embed.setImage(giveaway.banner_url);
    if (giveaway.ends_at) embed.setFooter({ text: `Ends at: ${new Date(giveaway.ends_at).toLocaleString()}` });

    let components = [];
    if (giveaway.method === 'button'){
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gw-enter:${giveaway._id}`).setLabel('Enter').setStyle(ButtonStyle.Success).setEmoji(giveaway.icon_emoji || '🎉')
      );
      components = [row];
    }

    const msg = await channel.send({ content: '🎉 Giveaway', embeds: [embed], components });
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
    const mentions = winners && winners.length ? winners.map(w=>`<@${w.user_id}>`).join(', ') : 'No entrants';
    await msg.reply({ content: `🎉 Winners: ${mentions}` });
    try { await msg.edit({ content: '🎉 Giveaway (ended)' }); } catch {}
    return { ok:true };
  } catch (e) { return { ok:false, error: e && e.message || String(e) }; }
}

module.exports = { publishGiveaway, announceWinners };
