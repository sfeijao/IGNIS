const { Events, EmbedBuilder } = require('discord.js');
const config = require('../utils/config');
const { EMBED_COLORS, EMOJIS } = require('../constants/ui');
const { WelcomeConfigModel } = require('../utils/db/models');
const logger = require('../utils/logger');

/**
 * Substituir placeholders na mensagem
 */
function replacePlaceholders(text, member, guild) {
  if (!text) return '';

  const memberCount = guild.memberCount;
  const createdAt = Math.floor(member.user.createdTimestamp / 1000);
  const joinedAt = member.joinedAt ? Math.floor(member.joinedAt.getTime() / 1000) : null;

  let result = text
    .replace(/\{user\}/g, member.user.tag) // Não mencionar (já saiu)
    .replace(/\{user\.tag\}/g, member.user.tag)
    .replace(/\{user\.username\}/g, member.user.username)
    .replace(/\{user\.id\}/g, member.user.id)
    .replace(/\{user\.avatar\}/g, member.user.displayAvatarURL({ dynamic: true }))
    .replace(/\{server\}/g, guild.name)
    .replace(/\{server\.name\}/g, guild.name)
    .replace(/\{server\.icon\}/g, guild.iconURL({ dynamic: true }) || '')
    .replace(/\{server\.id\}/g, guild.id)
    .replace(/\{memberCount\}/g, memberCount.toString())
    .replace(/\{createdAt\}/g, `<t:${createdAt}:R>`);

  if (joinedAt) {
    result = result.replace(/\{joinedAt\}/g, `<t:${joinedAt}:R>`);
  }

  return result;
}

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const guild = member.guild;

        // 🆕 SISTEMA DE GOODBYE CUSTOMIZÁVEL
        try {
          const welcomeConfig = await WelcomeConfigModel.findOne({
            guild_id: guild.id
          }).lean();

          if (welcomeConfig?.goodbye?.enabled && welcomeConfig.goodbye.channel_id) {
            const channel = guild.channels.cache.get(welcomeConfig.goodbye.channel_id) ||
                           await guild.channels.fetch(welcomeConfig.goodbye.channel_id).catch(() => null);

            if (channel) {
              const payload = {};

              // Mensagem de texto (opcional)
              if (welcomeConfig.goodbye.message) {
                payload.content = replacePlaceholders(welcomeConfig.goodbye.message, member, guild);
              }

              // Embed (se habilitado)
              if (welcomeConfig.goodbye.embed?.enabled) {
                const embedData = welcomeConfig.goodbye.embed;
                const embed = new EmbedBuilder()
                  .setColor(embedData.color || 0xEF4444);

                if (embedData.title) {
                  embed.setTitle(replacePlaceholders(embedData.title, member, guild));
                }

                if (embedData.description) {
                  embed.setDescription(replacePlaceholders(embedData.description, member, guild));
                }

                // Thumbnail
                if (embedData.thumbnail) {
                  const thumb = replacePlaceholders(embedData.thumbnail, member, guild);
                  if (thumb) embed.setThumbnail(thumb);
                }

                // Image
                if (embedData.image) {
                  const img = replacePlaceholders(embedData.image, member, guild);
                  if (img) embed.setImage(img);
                }

                // Footer
                if (embedData.footer || embedData.show_footer_timestamp) {
                  const footerText = embedData.footer ?
                    replacePlaceholders(embedData.footer, member, guild) :
                    null;
                  embed.setFooter({ text: footerText || 'Membro desde' });
                  if (embedData.show_footer_timestamp && member.joinedAt) {
                    embed.setTimestamp(member.joinedAt);
                  }
                }

                payload.embeds = [embed];
              }

              // Enviar mensagem
              if (payload.content || payload.embeds) {
                await channel.send(payload);
                logger.info(`[Goodbye] Sent goodbye message for ${member.user.tag} in ${guild.name}`);
              }
            }
          }
        } catch (goodbyeError) {
          logger.error('[Goodbye] Error sending goodbye message:', goodbyeError);
          // Não bloquear outros sistemas
        }

        // Sistema de logs legado (manter compatibilidade)
        const logsChannel = guild.channels.cache.get(config.CHANNELS.LOGS);

        try {
            const storage = require('../utils/storage');
            await storage.addLog({ guild_id: member.guild.id, type: 'mod_member_leave', message: member.user.id, data: { userId: member.user.id, joinedAt: member.joinedAt } });
            // Log member leave to database
            if (member.client.database) {
                await member.client.database.createLog({
                    guild_id: member.guild.id,
                    type: 'member_leave',
                    user_id: member.id,
                    data: {
                        username: member.user.username,
                        description: `${member.user.username} saiu do servidor`
                    }
                });

                // Record analytics
                await member.client.database.recordAnalytics(
                    member.guild.id,
                    'member_left',
                    1,
                    {
                        userId: member.id,
                        username: member.user.username
                    }
                );
            }

            // Send socket event for dashboard
            if (member.client.socketManager) {
                member.client.socketManager.onDiscordEvent('guildMemberRemove', member.guild.id, {
                    userId: member.id,
                    username: member.user.username,
                    avatar: member.user.displayAvatarURL(),
                    leftAt: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('Erro ao processar saída de membro:', error);
        }

        // Log de membro que saiu
        if (logsChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(EMBED_COLORS.ERROR)
                .setTitle(`${EMOJIS.ERROR} Membro Saiu`)
                .setDescription(`${member.user.tag} saiu do servidor`)
                .addFields([
                    { name: 'Utilizador', value: `${member.user.tag}`, inline: true },
                    { name: 'ID', value: `${member.user.id}`, inline: true },
                    { name: 'Entrou', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Desconhecido', inline: true }
                ])
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: 'Sistema de Logs' });

            logsChannel.send({ embeds: [logEmbed] });
        }
    }
};
