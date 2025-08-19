const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bot-status')
        .setDescription('Verifica o status e configuração do bot'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#9932CC')
            .setTitle('🤖 Status do Bot')
            .addFields(
                { name: '🆔 Bot ID', value: interaction.client.user.id, inline: true },
                { name: '🏷️ Bot Tag', value: interaction.client.user.tag, inline: true },
                { name: '🌐 Servidor', value: interaction.guild.name, inline: true },
                { name: '📊 Comandos Carregados', value: `${interaction.client.commands.size}`, inline: true },
                { name: '🏓 Ping', value: `${interaction.client.ws.ping}ms`, inline: true },
                { name: '⏰ Online há', value: `<t:${Math.floor((Date.now() - interaction.client.readyTimestamp) / 1000)}:R>`, inline: true },
                { name: '🔧 Permissões', value: 'Verificando...', inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
