const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Testa resposta do bot'),
    
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('🏓 Pong!')
            .setDescription(`Latência: \`${Date.now() - interaction.createdTimestamp}ms\`\nAPI: \`${Math.round(interaction.client.ws.ping)}ms\``)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
