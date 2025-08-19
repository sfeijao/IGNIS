const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('teste-simples')
        .setDescription('Teste básico de resposta'),

    async execute(interaction) {
        try {
            await interaction.reply('✅ Funcionando!');
            console.log('✅ Comando teste-simples executado com sucesso');
        } catch (error) {
            console.error('❌ Erro no teste-simples:', error);
        }
    },
};
