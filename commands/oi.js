const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oi')
        .setDescription('Teste ultra simples'),

    async execute(interaction) {
        await interaction.reply('Oi! Funcionou!');
    },
};
