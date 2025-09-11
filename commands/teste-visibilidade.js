const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('teste-visibilidade')
        .setDescription('Comando de teste para verificar se está visível'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('✅ Comando Funcionando!')
            .setDescription('Este comando está visível e funcionando corretamente!')
            .setColor(0x4CAF50)
            .addFields(
                { name: '🕐 Horário', value: new Date().toLocaleString('pt-BR'), inline: true },
                { name: '🏠 Servidor', value: interaction.guild.name, inline: true },
                { name: '👤 Usuário', value: interaction.user.tag, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};