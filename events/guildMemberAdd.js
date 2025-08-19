const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const guild = member.guild;
        const welcomeChannel = guild.channels.cache.get(config.channels.verification);
        const logsChannel = guild.channels.cache.get(config.channels.logs);
        
        // Log de novo membro
        if (logsChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('👋 Novo Membro')
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
                .setColor(0x5865f2)
                .setTitle(`👋 Bem-vindo ${member.user.username}!`)
                .setDescription(`Bem-vindo ao **${config.serverName}**!\n\n` +
                    'Para começar, por favor:\n' +
                    '1. Lê as regras do servidor\n' +
                    '2. Completa a verificação\n' +
                    '3. Escolhe as tuas tags\n' +
                    '4. Diverte-te na comunidade!')
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: 'YSNM Community' });

            welcomeChannel.send({ 
                content: `${member}`, 
                embeds: [welcomeEmbed] 
            });
        }
    },
};
