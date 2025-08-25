const { Events, EmbedBuilder } = require('discord.js');
const config = require('../utils/config');
const { EMBED_COLORS, EMOJIS } = require('../constants/ui');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const guild = member.guild;
        const logsChannel = guild.channels.cache.get(config.CHANNELS.LOGS);
        
        try {
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
