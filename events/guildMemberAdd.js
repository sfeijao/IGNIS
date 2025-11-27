const { Events, EmbedBuilder } = require('discord.js');
const config = require('../utils/config');
const { EMBED_COLORS, EMOJIS } = require('../constants/ui');
const { WelcomeConfigModel } = require('../utils/db/models');
const inviteTrackerService = require('../src/services/inviteTrackerService');
const antiRaidService = require('../src/services/antiRaidService');
const logger = require('../utils/logger');

/**
 * Substituir placeholders na mensagem
 */
function replacePlaceholders(text, member, guild) {
  if (!text) return '';

  const memberCount = guild.memberCount;
  const createdAt = Math.floor(member.user.createdTimestamp / 1000);
  const joinedAt = Math.floor(Date.now() / 1000);

  return text
    .replace(/\{user\}/g, `${member}`) // Menção
    .replace(/\{user\.mention\}/g, `${member}`)
    .replace(/\{user\.tag\}/g, member.user.tag)
    .replace(/\{user\.username\}/g, member.user.username)
    .replace(/\{user\.id\}/g, member.user.id)
    .replace(/\{user\.avatar\}/g, member.user.displayAvatarURL({ dynamic: true }))
    .replace(/\{server\}/g, guild.name)
    .replace(/\{server\.name\}/g, guild.name)
    .replace(/\{server\.icon\}/g, guild.iconURL({ dynamic: true }) || '')
    .replace(/\{server\.id\}/g, guild.id)
    .replace(/\{memberCount\}/g, memberCount.toString())
    .replace(/\{joinedAt\}/g, `<t:${joinedAt}:R>`)
    .replace(/\{createdAt\}/g, `<t:${createdAt}:R>`);
}

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const guild = member.guild;

        // 🛡️ ANTI-RAID: Detectar e prevenir raids
        try {
            const raidEvent = await antiRaidService.detectRaid(guild, member);
            if (raidEvent) {
                const analysis = await antiRaidService.analyzeMember(guild, member, raidEvent);
                if (analysis.actionTaken !== 'none') {
                    logger.warn(`[AntiRaid] Action taken on ${member.user.tag}: ${analysis.actionTaken}`);
                }
            }
        } catch (error) {
            logger.error('[MemberAdd] Error in anti-raid check:', error);
        }

        // 🎯 INVITE TRACKER: Detectar convite usado
        try {
            const usedInvite = await inviteTrackerService.detectUsedInvite(guild, member);
            if (usedInvite) {
                await inviteTrackerService.trackMemberJoin(guild, member, usedInvite.code);
                logger.info(`[MemberAdd] ${member.user.tag} joined via invite ${usedInvite.code}`);
            }
        } catch (error) {
            logger.error('[MemberAdd] Error tracking invite:', error);
        }

        // 🆕 SISTEMA DE BOAS-VINDAS CUSTOMIZÁVEL
        try {
          const welcomeConfig = await WelcomeConfigModel.findOne({
            guild_id: guild.id
          }).lean();

          if (welcomeConfig?.welcome?.enabled && welcomeConfig.welcome.channel_id) {
            const channel = guild.channels.cache.get(welcomeConfig.welcome.channel_id) ||
                           await guild.channels.fetch(welcomeConfig.welcome.channel_id).catch(() => null);

            if (channel) {
              const payload = {};

              // Mensagem de texto (opcional)
              if (welcomeConfig.welcome.message) {
                payload.content = replacePlaceholders(welcomeConfig.welcome.message, member, guild);
              }

              // Embed (se habilitado)
              if (welcomeConfig.welcome.embed?.enabled) {
                const embedData = welcomeConfig.welcome.embed;
                const embed = new EmbedBuilder()
                  .setColor(embedData.color || 0x10B981);

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

                // Image (banner)
                if (embedData.image) {
                  const img = replacePlaceholders(embedData.image, member, guild);
                  if (img) embed.setImage(img);
                }

                // Footer
                if (embedData.footer || embedData.show_footer_timestamp) {
                  const footerText = embedData.footer ?
                    replacePlaceholders(embedData.footer, member, guild) :
                    null;
                  embed.setFooter({ text: footerText || 'Conta criada' });
                  if (embedData.show_footer_timestamp) {
                    embed.setTimestamp(member.user.createdAt);
                  }
                }

                payload.embeds = [embed];
              }

              // Enviar mensagem
              if (payload.content || payload.embeds) {
                await channel.send(payload);
                logger.info(`[Welcome] Sent welcome message for ${member.user.tag} in ${guild.name}`);
              }
            }
          }
        } catch (welcomeError) {
          logger.error('[Welcome] Error sending welcome message:', welcomeError);
          // Não bloquear outros sistemas se falhar
        }

        // Sistema de verificação legado (manter compatibilidade)
        const welcomeChannel = guild.channels.cache.get(config.CHANNELS.VERIFICATION);
        const logsChannel = guild.channels.cache.get(config.CHANNELS.LOGS);

        // Analytics e database logging
        try {
            // Log member join to database
            if (member.client.database) {
                await member.client.database.createLog({
                    guild_id: member.guild.id,
                    type: 'member_join',
                    user_id: member.id,
                    data: {
                        username: member.user.username,
                        description: `${member.user.username} entrou no servidor`
                    }
                });

                // Record analytics
                await member.client.database.recordAnalytics(
                    member.guild.id,
                    'member_joined',
                    1,
                    {
                        userId: member.id,
                        username: member.user.username,
                        accountAge: Date.now() - member.user.createdTimestamp
                    }
                );
            }

            // Send socket event for dashboard
            if (member.client.socketManager) {
                member.client.socketManager.onDiscordEvent('guildMemberAdd', member.guild.id, {
                    userId: member.id,
                    username: member.user.username,
                    avatar: member.user.displayAvatarURL(),
                    joinedAt: new Date().toISOString()
                });
            }
            // Persist moderation log
            try {
                const storage = require('../utils/storage');
                await storage.addLog({ guild_id: member.guild.id, type: 'mod_member_join', message: member.user.id, data: { userId: member.user.id } });
            } catch (e) { logger.debug('Caught error:', e?.message || e); }
        } catch (error) {
            console.error('Erro ao processar entrada de membro:', error);
        }

        // Log de novo membro
        if (logsChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(EMBED_COLORS.SUCCESS)
                .setTitle(`${EMOJIS.USER} Novo Membro`)
                .setDescription(`${member.user.tag} juntou-se ao servidor!`)
                .addFields([
                    { name: 'Utilizador', value: `${member.user.tag}`, inline: true },
                    { name: 'ID', value: `${member.user.id}`, inline: true },
                    { name: 'Conta Criada', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                ])
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: 'Sistema de Logs' });

            logsChannel.send({ embeds: [logEmbed] });
        }

        // Mensagem de boas-vindas (opcional)
        if (welcomeChannel) {
            const welcomeEmbed = new EmbedBuilder()
                .setColor(EMBED_COLORS.INFO)
                .setTitle(`${EMOJIS.SUCCESS} Bem-vindo ${member.user.username}!`)
                .setDescription(`Bem-vindo ao **IGNIS Community**!\n\n` +
                    '1. Lê as regras do servidor\n' +
                    '2. Completa a verificação\n' +
                    '3. Escolhe as tuas tags\n' +
                    '4. Diverte-te na comunidade!')
                .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
                .setTimestamp()
                .setFooter({
                    text: 'IGNIS Community',
                    iconURL: member.user.displayAvatarURL()
                });

            welcomeChannel.send({
                content: `${member}`,
                embeds: [welcomeEmbed]
            });
        }
    },
};
