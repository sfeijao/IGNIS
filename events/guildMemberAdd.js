const { Events, EmbedBuilder } = require('discord.js');
const config = require('../utils/config');
const { EMBED_COLORS, EMOJIS } = require('../constants/ui');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const guild = member.guild;
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
            } catch {}
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
